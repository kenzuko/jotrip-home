// Place-data corrections only. Never turns a public report into verified data.
const TYPES = new Set(["place","activity","venue","hotel","utility","article","general"]);
const ISSUES = new Set(["closed","location","hours","phone","details","new_place","other","translation"]);
const LANGUAGES = new Set(["vi","en","ko","ru","lo","zh-CN","zh-TW","fr"]);
const TRANSLATION_LANGUAGES = new Set(["ko","ru","lo","zh-CN","zh-TW","fr"]);
const STATUSES = new Set(["new","reviewing","resolved","rejected"]);
// Prefer a dedicated secret. CMS Pages can safely derive a separate HMAC key from its existing session secret.
const feedbackRateKey=env=>env.FEEDBACK_RATE_SECRET|| (env.CMS_SESSION_SECRET?"openpq-feedback-rate-v1:"+env.CMS_SESSION_SECRET:"");
const json = (value,status=200) => new Response(JSON.stringify(value),{
  status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}
});
const clean=(value,max=250)=>String(value||"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);
const validId=id=>/^[a-zA-Z0-9_-]{1,120}$/.test(id);
function originAllowed(request){
  const origin=request.headers.get("origin");
  return !!origin&&origin===new URL(request.url).origin;
}
async function dailyHash(ip,secret){
  const date=new Date().toISOString().slice(0,10);
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const bytes=new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(date+":"+ip)));
  return [...bytes].map(x=>x.toString(16).padStart(2,"0")).join("");
}
function imageType(bytes){
  if(bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return ["image/jpeg","jpg"];
  if(bytes.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return ["image/png","png"];
  if(bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==="RIFF"&&String.fromCharCode(...bytes.slice(8,12))==="WEBP")return ["image/webp","webp"];
  return null;
}
function sourcePath(value,requestUrl){
  try{
    const u=new URL(String(value));
    if(u.origin!==new URL(requestUrl).origin)return "/";
    const id=u.searchParams.get("id");
    return clean(u.pathname+(id&&validId(id)?"?id="+encodeURIComponent(id):""),350);
  }catch{return "/";}
}
export async function publicConfig(env){
  let enabled=!!(env.CMS_DB&&feedbackRateKey(env));
  if(enabled){
    try{await env.CMS_DB.prepare("SELECT language FROM cms_place_feedback LIMIT 1").first();} // Fails closed until the additive locale migration exists.
    catch{enabled=false;}
  }
  return json({ok:true,enabled,photo_enabled:enabled&&!!env.FEEDBACK_IMAGES,max_photo_bytes:3145728});
}
export async function publicSubmit(request,env){
  if(request.method!=="POST")return json({ok:false,error:"method_not_allowed"},405);
  if(!originAllowed(request))return json({ok:false,error:"origin_not_allowed"},403);
  if(!String(request.headers.get("content-type")||"").includes("multipart/form-data"))return json({ok:false,error:"invalid_form"},415);
  if(Number(request.headers.get("content-length")||0)>4200000)return json({ok:false,error:"too_large"},413);
  const rateKey=feedbackRateKey(env);
  if(!env.CMS_DB||!rateKey)return json({ok:false,error:"feedback_not_configured"},503);
  let form;
  try{form=await request.formData()}catch{return json({ok:false,error:"invalid_form"},400);}
  if(form.get("website"))return json({ok:true,received:true}); // Honeypot. Store nothing.
  const issue=clean(form.get("issue"),32),type=clean(form.get("entity_type"),32);
  const entityId=clean(form.get("entity_id"),120),label=clean(form.get("entity_label"),120);
  const details=clean(form.get("details"),1500),url=sourcePath(form.get("source_url"),request.url);
  const language=clean(form.get("language"),12)||"vi";
  const revision=clean(form.get("source_revision"),80);
  const quotedText=clean(form.get("quoted_text"),500);
  const suggestedText=clean(form.get("suggested_text"),1500);
  if(!ISSUES.has(issue)||!TYPES.has(type)||(!validId(entityId)&&issue!=="new_place")||
    !label||label.length<2||!LANGUAGES.has(language)||(issue==="new_place"&&details.length<10)||
    (issue==="translation"&&(type!=="article"||!TRANSLATION_LANGUAGES.has(language)||Math.max(details.length,suggestedText.length)<5))||
    (revision&&!/^[a-zA-Z0-9._:-]{1,80}$/.test(revision)))
    return json({ok:false,error:"invalid_fields"},400);
  const attachment=form.get("photo");
  let image=null;
  if(attachment&&typeof attachment==="object"&&Number(attachment.size)>0){
    if(!env.FEEDBACK_IMAGES)return json({ok:false,error:"photos_unavailable"},422);
    if(attachment.size>3145728)return json({ok:false,error:"photo_too_large"},413);
    const bytes=new Uint8Array(await attachment.arrayBuffer()),detected=imageType(bytes);
    if(!detected)return json({ok:false,error:"invalid_photo"},415);
    image={bytes,type:detected[0],ext:detected[1]};
  }
  const hash=await dailyHash(request.headers.get("CF-Connecting-IP")||"unknown",String(rateKey));
  const db=env.CMS_DB,now=new Date(),since=new Date(now.valueOf()-3600000).toISOString();
  try{
    const rate=await db.prepare("SELECT COUNT(*) AS total FROM cms_place_feedback WHERE submit_hash=? AND created_at>=?")
      .bind(hash,since).first();
    if(Number(rate?.total||0)>=5)return json({ok:false,error:"rate_limited"},429);
  }catch(error){
    console.error("feedback rate gate unavailable",error);
    return json({ok:false,error:"storage_unavailable"},503);
  }
  const id=crypto.randomUUID(),time=now.toISOString();
  const key=image?"pending/"+id+"."+image.ext:null;
  if(image){
    try{await env.FEEDBACK_IMAGES.put(key,image.bytes,{httpMetadata:{contentType:image.type},customMetadata:{feedbackId:id}});}
    catch(error){console.error("feedback photo save failed",error);return json({ok:false,error:"photo_save_failed"},503);}
  }
  try{
    await db.prepare(
      "INSERT INTO cms_place_feedback(id,issue,entity_type,entity_id,entity_label,details,source_path,image_key,image_mime,submit_hash,created_at,status,language,source_revision,quoted_text,suggested_text) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
    ).bind(id,issue,type,entityId||null,label,details,url,key,image?.type||null,hash,time,"new",language,issue==="translation"?revision:"",issue==="translation"?quotedText:"",issue==="translation"?suggestedText:"").run();
  }catch(error){
    if(key)await env.FEEDBACK_IMAGES.delete(key).catch(()=>{});
    console.error("feedback storage failed",error);
    return json({ok:false,error:"storage_unavailable"},503);
  }
  return json({ok:true,received:true,reference:id},201);
}
export async function adminFeedback(request,env,sessionHandler,{photo=false}={}){
  // Reuse existing GitHub CMS session + live role check. Do not expose anonymous queue.
  const sessionResponse=await sessionHandler({request,env});
  if(sessionResponse.status!==200)return sessionResponse;
  const actor=await sessionResponse.json();
  if(!env.CMS_DB)return json({ok:false,error:"storage_unavailable"},503);
  const db=env.CMS_DB;
  if(photo){
    if(request.method!=="GET")return json({error:"method_not_allowed"},405);
    const id=new URL(request.url).searchParams.get("id")||"";
    if(!validId(id))return json({error:"invalid_id"},400);
    const record=await db.prepare("SELECT image_key,image_mime FROM cms_place_feedback WHERE id=?").bind(id).first();
    if(!record?.image_key||!env.FEEDBACK_IMAGES)return json({error:"image_not_found"},404);
    const obj=await env.FEEDBACK_IMAGES.get(record.image_key);
    if(!obj)return json({error:"image_not_found"},404);
    return new Response(obj.body,{headers:{"content-type":record.image_mime,"cache-control":"private, no-store","x-content-type-options":"nosniff","content-security-policy":"default-src 'none'; sandbox"}});
  }
  if(request.method==="GET"){
    const url=new URL(request.url);
    const status=clean(url.searchParams.get("status"),24);
    const kind=clean(url.searchParams.get("kind"),24);
    const language=clean(url.searchParams.get("language"),12);
    if(status&&!STATUSES.has(status))return json({error:"invalid_status"},400);
    if(kind&&!["translation","new_place","general"].includes(kind))return json({error:"invalid_kind"},400);
    if(language&&!LANGUAGES.has(language))return json({error:"invalid_language"},400);
    const offsetRaw=Number(url.searchParams.get("offset")||0);
    if(!Number.isInteger(offsetRaw)||offsetRaw<0||offsetRaw>10000)return json({error:"invalid_offset"},400);
    const limit=50,offset=offsetRaw,conditions=[],args=[];
    if(status){conditions.push("status=?");args.push(status);}
    if(kind==="translation"){conditions.push("issue=?");args.push("translation");}
    if(kind==="new_place"){conditions.push("issue=?");args.push("new_place");}
    if(kind==="general"){conditions.push("issue<>?");args.push("translation");}
    if(language){conditions.push("language=?");args.push(language);}
    const select="SELECT id,issue,entity_type,entity_id,entity_label,details,source_path,image_key IS NOT NULL AS has_photo,created_at,status,moderator_note,reviewed_at,reviewed_by,language,source_revision,quoted_text,suggested_text,approved_text FROM cms_place_feedback";
    const q=db.prepare(select+(conditions.length?" WHERE "+conditions.join(" AND "):"")+" ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?").bind(...args,limit+1,offset);
    try{
      const result=await q.all();
      const rows=result.results||[];
      return json({ok:true,items:rows.slice(0,limit),limit,offset,has_more:rows.length>limit,next_offset:rows.length>limit?offset+limit:null});
    }catch(error){console.error("feedback inbox failed",error);return json({error:"storage_unavailable"},503);}
  }
  if(request.method==="PATCH"){
    if(!["admin","editor"].includes(actor.role))return json({error:"forbidden"},403);
    if(!originAllowed(request))return json({error:"origin_not_allowed"},403);
    if(!String(request.headers.get("content-type")||"").includes("application/json"))return json({error:"invalid_form"},415);
    let payload;try{payload=await request.json()}catch{return json({error:"invalid_json"},400)}
    const id=clean(payload.id,120),status=clean(payload.status,30),note=clean(payload.note,1000);
    if(!validId(id)||!STATUSES.has(status))return json({error:"invalid_fields"},400);
    if(["resolved","rejected"].includes(status)&&note.length<10)return json({error:"note_required"},400);
    const approvedText=clean(payload.approved_text,1500);
    let record=null;
    if(status==="resolved"||approvedText){
      record=await db.prepare("SELECT issue,entity_type,entity_id,source_path,language,source_revision,quoted_text FROM cms_place_feedback WHERE id=?").bind(id).first();
      if(!record)return json({error:"not_found"},404);
      if(approvedText&&record.issue!=="translation")return json({error:"invalid_approval"},400);
      if(status==="resolved"&&record.issue==="translation"&&approvedText.length<3)
        return json({error:"approved_text_required"},400);
    }
    const reviewedAt=new Date().toISOString();
    const update=db.prepare("UPDATE cms_place_feedback SET status=?,moderator_note=?,reviewed_at=?,reviewed_by=?,approved_text=? WHERE id=?")
      .bind(status,note,reviewedAt,actor.login,status==="resolved"?approvedText:"",id);
    try{
      // Batch keeps approved text and reusable corrections consistent. Never changes published copy.
      const tasks=[update];
      if(status==="resolved"&&record?.issue==="translation"){
        tasks.push(db.prepare(
          "INSERT INTO cms_translation_corrections(feedback_id,entity_id,source_path,language,source_revision,quoted_text,approved_text,approved_at,approved_by) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(feedback_id) DO UPDATE SET approved_text=excluded.approved_text,approved_at=excluded.approved_at,approved_by=excluded.approved_by"
        ).bind(id,record.entity_id||"",record.source_path,record.language,record.source_revision||"",record.quoted_text||"",approvedText,reviewedAt,actor.login));
      }else{
        tasks.push(db.prepare("DELETE FROM cms_translation_corrections WHERE feedback_id=?").bind(id));
      }
      const result=await db.batch(tasks);
      if(!result[0]?.meta?.changes)return json({error:"not_found"},404);
      return json({ok:true,id,status,reviewed_at:reviewedAt,correction_saved:status==="resolved"&&record?.issue==="translation"});
    }catch(error){console.error("feedback review failed",error);return json({error:"storage_unavailable"},503);}
  }
  return json({error:"method_not_allowed"},405);
}

/* Housekeeping runs once per day from the existing Worker cron; no added schedule. */
export async function cleanupFeedback(env,now=Date.now()){
  if(!env.CMS_DB)return {deleted:0,skipped:0};
  const cutoff=new Date(now-180*86400000).toISOString();
  const expired=await env.CMS_DB.prepare(
    "SELECT id,image_key FROM cms_place_feedback WHERE created_at<? ORDER BY created_at ASC LIMIT 100"
  ).bind(cutoff).all();
  let deleted=0,skipped=0;
  for(const record of expired.results||[]){
    if(record.image_key){
      if(!env.FEEDBACK_IMAGES){skipped++;continue;}
      try{await env.FEEDBACK_IMAGES.delete(record.image_key);}
      catch{skipped++;continue;}
    }
    const result=await env.CMS_DB.prepare("DELETE FROM cms_place_feedback WHERE id=? AND created_at<?")
      .bind(record.id,cutoff).run();
    deleted+=Number(result.meta?.changes||0);
  }
  return {deleted,skipped};
}
