// Place-data corrections only. Never turns a public report into verified data.
const TYPES = new Set(["place","activity","venue","hotel","utility","article","general"]);
const ISSUES = new Set(["closed","location","hours","phone","details","new_place","other","translation"]);
const LANGUAGES = new Set(["vi","en","ko","ru","lo","zh-Hans","zh-Hant","fr"]);
const TRANSLATION_LANGUAGES = new Set(["ko","ru","lo","zh-Hans","zh-Hant","fr"]);
const STATUSES = new Set(["new","reviewing","resolved","rejected"]);
// Prefer a dedicated secret. CMS Pages can safely derive a separate HMAC key from its existing session secret.
const feedbackRateKey=env=>env.FEEDBACK_RATE_SECRET|| (env.CMS_SESSION_SECRET?"openpq-feedback-rate-v1:"+env.CMS_SESSION_SECRET:"");
const json = (value,status=200) => new Response(JSON.stringify(value),{
  status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}
});
const clean=(value,max=250)=>String(value||"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);
const normalize=value=>clean(value,1500).normalize("NFKC").toLowerCase().replace(/\s+/g," ").trim();
// Report similarities are only triage hints: never treat popularity as proof of accuracy.
async function triageFingerprint({issue,type,id,label,details,language,quote,suggestion,url}){
  const entity=id||url;
  const topic=issue==="translation"?(quote||suggestion||details):
    issue==="new_place"?label:
    ["details","other"].includes(issue)?details:"";
  // General page-level reports without meaningful text should never be merged.
  if(!entity||((issue==="other"||issue==="details")&&!normalize(topic)))return "";
  const payload=JSON.stringify(["v1",issue,type,normalize(entity),language,normalize(topic)]);
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(digest)).map(v=>v.toString(16).padStart(2,"0")).join("").slice(0,24);
}
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
    try{await env.CMS_DB.prepare("SELECT triage_key FROM cms_place_feedback LIMIT 1").first();} // Fail closed before the additive V3 migration.
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
  const triageKey=await triageFingerprint({issue,type,id:entityId,label,details,language,quote:quotedText,suggestion:suggestedText,url});
  const key=image?"pending/"+id+"."+image.ext:null;
  if(image){
    try{await env.FEEDBACK_IMAGES.put(key,image.bytes,{httpMetadata:{contentType:image.type},customMetadata:{feedbackId:id}});}
    catch(error){console.error("feedback photo save failed",error);return json({ok:false,error:"photo_save_failed"},503);}
  }
  try{
    await db.prepare(
      "INSERT INTO cms_place_feedback(id,issue,entity_type,entity_id,entity_label,details,source_path,image_key,image_mime,submit_hash,created_at,status,language,source_revision,quoted_text,suggested_text,triage_key) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
    ).bind(id,issue,type,entityId||null,label,details,url,key,image?.type||null,hash,time,"new",language,issue==="translation"?revision:"",issue==="translation"?quotedText:"",issue==="translation"?suggestedText:"",triageKey).run();
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
    const sort=clean(url.searchParams.get("sort"),24)||"recent";
    const related=clean(url.searchParams.get("related"),24);
    if(status&&!STATUSES.has(status))return json({error:"invalid_status"},400);
    if(kind&&!["translation","new_place","general"].includes(kind))return json({error:"invalid_kind"},400);
    if(language&&!LANGUAGES.has(language))return json({error:"invalid_language"},400);
    if(!["recent","repeated"].includes(sort))return json({error:"invalid_sort"},400);
    if(related&&!/^[0-9a-f]{24}$/.test(related))return json({error:"invalid_related"},400);
    const offsetRaw=Number(url.searchParams.get("offset")||0);
    if(!Number.isInteger(offsetRaw)||offsetRaw<0||offsetRaw>10000)return json({error:"invalid_offset"},400);
    const limit=50,offset=offsetRaw,conditions=[],args=[];
    if(status){conditions.push("f.status=?");args.push(status);}
    if(kind==="translation"){conditions.push("f.issue=?");args.push("translation");}
    if(kind==="new_place"){conditions.push("f.issue=?");args.push("new_place");}
    if(kind==="general"){conditions.push("f.issue NOT IN ('translation','new_place')");}
    if(language){conditions.push("f.language=?");args.push(language);}
    if(related){conditions.push("f.triage_key=?");args.push(related);}
    const select="SELECT f.id,f.issue,f.entity_type,f.entity_id,f.entity_label,f.details,f.source_path,f.image_key IS NOT NULL AS has_photo,"+
      "f.created_at,f.status,f.moderator_note,f.reviewed_at,f.reviewed_by,f.language,f.source_revision,"+
      "f.quoted_text,f.suggested_text,f.approved_text,f.triage_key,"+
      "(CASE WHEN f.triage_key='' THEN 1 ELSE (SELECT COUNT(*) FROM cms_place_feedback d WHERE d.triage_key=f.triage_key) END) AS similar_count "+
      "FROM cms_place_feedback f";
    const order=sort==="repeated"?" ORDER BY similar_count DESC,f.created_at DESC,f.id DESC":" ORDER BY f.created_at DESC,f.id DESC";
    const q=db.prepare(select+(conditions.length?" WHERE "+conditions.join(" AND "):"")+order+" LIMIT ? OFFSET ?").bind(...args,limit+1,offset);
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

/* Read-only, role-checked translation memory. No unaudited publishing or API spend. */
export async function adminCorrections(request,env,sessionHandler){
  if(request.method!=="GET")return json({error:"method_not_allowed"},405);
  const authenticated=await sessionHandler({request,env});
  if(authenticated.status!==200)return authenticated;
  if(!env.CMS_DB)return json({error:"storage_unavailable"},503);
  const url=new URL(request.url);
  const language=clean(url.searchParams.get("language"),12);
  const source=clean(url.searchParams.get("source_path"),350);
  const q=clean(url.searchParams.get("q"),80);
  if(language&&!TRANSLATION_LANGUAGES.has(language))return json({error:"invalid_language"},400);
  if(source&&!/^\/(?:stories|guide)\/[a-zA-Z0-9/._-]+(?:\?id=[a-zA-Z0-9_-]{1,120})?$/.test(source))
    return json({error:"invalid_source"},400);
  const offset=Number(url.searchParams.get("offset")||0);
  if(!Number.isInteger(offset)||offset<0||offset>10000)return json({error:"invalid_offset"},400);
  const conditions=[],args=[];
  if(language){conditions.push("language=?");args.push(language);}
  if(source){conditions.push("source_path=?");args.push(source);}
  if(q){
    const like="%"+q.replace(/[\\%_]/g,c=>"\\"+c)+"%";
    conditions.push("(quoted_text LIKE ? ESCAPE '\\' OR approved_text LIKE ? ESCAPE '\\' OR entity_id LIKE ? ESCAPE '\\')");
    args.push(like,like,like);
  }
  const sql="SELECT feedback_id,entity_id,source_path,language,source_revision,quoted_text,approved_text,approved_at,approved_by "+
    "FROM cms_translation_corrections"+(conditions.length?" WHERE "+conditions.join(" AND "):"")+
    " ORDER BY approved_at DESC,feedback_id DESC LIMIT ? OFFSET ?";
  try{
    const limit=50,rows=(await env.CMS_DB.prepare(sql).bind(...args,limit+1,offset).all()).results||[];
    return json({ok:true,items:rows.slice(0,limit),offset,limit,has_more:rows.length>limit,next_offset:rows.length>limit?offset+limit:null,
      reuse_rule:"Exact article, language, quoted passage and source revision; verify conflicting corrections before reuse."});
  }catch(error){console.error("CMS corrections read failed",error);return json({error:"storage_unavailable"},503);}
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
