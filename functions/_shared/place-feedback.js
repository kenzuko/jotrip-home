// Place-data corrections only. Never turns a public report into verified data.
const TYPES = new Set(["place","activity","venue","hotel","utility","article","general"]);
const ISSUES = new Set(["closed","location","hours","phone","details","new_place","other"]);
const STATUSES = new Set(["new","reviewing","resolved","rejected"]);
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
  let enabled=!!(env.CMS_DB&&env.FEEDBACK_RATE_SECRET);
  if(enabled){
    try{await env.CMS_DB.prepare("SELECT 1 AS ready FROM cms_place_feedback LIMIT 1").first();}
    catch{enabled=false;}
  }
  return json({ok:true,enabled,photo_enabled:enabled&&!!env.FEEDBACK_IMAGES,max_photo_bytes:3145728});
}
export async function publicSubmit(request,env){
  if(request.method!=="POST")return json({ok:false,error:"method_not_allowed"},405);
  if(!originAllowed(request))return json({ok:false,error:"origin_not_allowed"},403);
  if(!String(request.headers.get("content-type")||"").includes("multipart/form-data"))return json({ok:false,error:"invalid_form"},415);
  if(Number(request.headers.get("content-length")||0)>4200000)return json({ok:false,error:"too_large"},413);
  if(!env.CMS_DB||!env.FEEDBACK_RATE_SECRET)return json({ok:false,error:"feedback_not_configured"},503);
  let form;
  try{form=await request.formData()}catch{return json({ok:false,error:"invalid_form"},400);}
  if(form.get("website"))return json({ok:true,received:true}); // Honeypot. Store nothing.
  const issue=clean(form.get("issue"),32),type=clean(form.get("entity_type"),32);
  const entityId=clean(form.get("entity_id"),120),label=clean(form.get("entity_label"),120);
  const details=clean(form.get("details"),1500),url=sourcePath(form.get("source_url"),request.url);
  if(!ISSUES.has(issue)||!TYPES.has(type)||(!validId(entityId)&&issue!=="new_place")||
    !label||label.length<2||(issue==="new_place"&&details.length<10))
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
  const hash=await dailyHash(request.headers.get("CF-Connecting-IP")||"unknown",String(env.FEEDBACK_RATE_SECRET));
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
      "INSERT INTO cms_place_feedback(id,issue,entity_type,entity_id,entity_label,details,source_path,image_key,image_mime,submit_hash,created_at,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)"
    ).bind(id,issue,type,entityId||null,label,details,url,key,image?.type||null,hash,time,"new").run();
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
    const status=clean(new URL(request.url).searchParams.get("status"),24);
    if(status&&!STATUSES.has(status))return json({error:"invalid_status"},400);
    const offsetRaw=Number(new URL(request.url).searchParams.get("offset")||0);
    if(!Number.isInteger(offsetRaw)||offsetRaw<0||offsetRaw>10000)return json({error:"invalid_offset"},400);
    const limit=50,offset=offsetRaw;
    const select="SELECT id,issue,entity_type,entity_id,entity_label,details,source_path,image_key IS NOT NULL AS has_photo,created_at,status,moderator_note,reviewed_at,reviewed_by FROM cms_place_feedback";
    const q=status
      ?db.prepare(select+" WHERE status=? ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?").bind(status,limit+1,offset)
      :db.prepare(select+" ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?").bind(limit+1,offset);
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
    const reviewedAt=new Date().toISOString();
    const result=await db.prepare("UPDATE cms_place_feedback SET status=?,moderator_note=?,reviewed_at=?,reviewed_by=? WHERE id=?")
      .bind(status,note,reviewedAt,actor.login,id).run();
    if(!result.meta?.changes)return json({error:"not_found"},404);
    return json({ok:true,id,status,reviewed_at:reviewedAt});
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
