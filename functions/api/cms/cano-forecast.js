import {session,currentRole,reply,timeVN} from "./cano-ops.js";
// Private forecast evidence. Never use the forecast to set canoe operations.
const REPO="kenzuko/Jotrip-Lab",REF="data-marine-ops";
const td=new TextDecoder();
const dbFor=env=>env.CMS_DB||env.ANALYTICS_DB||null;
function decode(s){
 s=String(s||"").replace(/\s/g,"").replace(/-/g,"+").replace(/_/g,"/");
 while(s.length%4)s+="=";
 return td.decode(Uint8Array.from(atob(s),c=>c.charCodeAt(0)));
}
async function gh(path,token){
 const r=await fetch("https://api.github.com"+path,{cache:"no-store",headers:{
  Accept:"application/vnd.github+json",Authorization:"Bearer "+token,
  "X-GitHub-Api-Version":"2022-11-28","User-Agent":"OpenPQ-Marine-Archive"
 }});
 if(!r.ok)throw Error("GitHub "+r.status);
 return r.json();
}
async function historicalNotes(token){
 try{
  const items=await gh("/repos/"+REPO+"/contents/data/marine_ops/forecast-bulletins?ref="+REF,token);
  if(!Array.isArray(items))return [];
  const matched=items.filter(x=>x.type==="file"&&/^\d{4}-\d{2}-\d{2}-[^/]+\.json$/.test(x.name))
    .sort((a,b)=>b.name.localeCompare(a.name)).slice(0,15);
  const response=await Promise.allSettled(matched.map(async item=>{
   const file=await gh("/repos/"+REPO+"/contents/"+item.path+"?ref="+REF,token);
   const d=JSON.parse(decode(file.content));
   return {id:item.name,local_date:d.date,issued_at_vn:d.issued_at_vn,valid_from_vn:d.valid_from_vn,
    valid_until_vn:d.valid_until_vn,issuer:d.issuer,area:d.area,summary:d.summary,
    source_reference:d.bulletin_id,created_at_vn:d.issued_at_vn,origin:"PUBLIC_METADATA",
    source_url:"https://github.com/"+REPO+"/blob/"+REF+"/"+item.path,attachment_name:null};
  }));
  return response.filter(x=>x.status==="fulfilled").map(x=>x.value);
 }catch{return [];}
}
function checkDate(value){
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))return null;
 const date=new Date(value+":00+07:00");
 return Number.isFinite(date.getTime())&&date.getTime()<Date.now()+86400000&&date.getTime()>new Date("2024-01-01").getTime()?value+":00+07:00":null;
}
function summaryRow(x){
 return {id:x.id,local_date:x.local_date,issued_at_vn:x.issued_at_vn,valid_from_vn:x.valid_from_vn,
  valid_until_vn:x.valid_until_vn,issuer:x.issuer,area:x.area,summary:x.summary,
  source_reference:x.source_reference,attachment_name:x.attachment_name,attachment_sha256:x.attachment_sha256,
  created_by:x.created_by,created_at_vn:x.created_at_vn,origin:"CMS_PRIVATE_D1"};
}
export async function onRequest({request,env}){
 const user=await session(request,String(env.CMS_SESSION_SECRET||""));
 if(!user)return reply({error:"Chưa đăng nhập CMS"},401);
 let role;try{role=await currentRole(user);}catch{return reply({error:"Chưa kiểm tra được quyền CMS"},503);}
 if(!["admin","operator"].includes(role))return reply({error:"Không có quyền lưu hồ sơ biển"},403);
 const db=dbFor(env),url=new URL(request.url);
 if(request.method==="GET"&&url.searchParams.has("attachment")){
  if(!db)return reply({error:"Chưa có kho lưu file"},503);
  const id=String(url.searchParams.get("attachment")||"");
  if(!/^[a-f0-9-]{36}$/.test(id))return reply({error:"Mã không hợp lệ"},400);
  try{
   const row=await db.prepare("SELECT attachment_bytes,attachment_mime,attachment_name FROM marine_forecast_bulletins WHERE id=?").bind(id).first();
   if(!row?.attachment_bytes)return reply({error:"Không có file đính kèm"},404);
   const safe=String(row.attachment_name||"bulletin").replace(/[^a-zA-Z0-9._-]/g,"_").slice(0,80);
   const bytes=row.attachment_bytes instanceof ArrayBuffer?row.attachment_bytes:Uint8Array.from(row.attachment_bytes).buffer;
   return new Response(bytes,{headers:{"Content-Type":row.attachment_mime||"application/octet-stream",
    "Content-Disposition":'attachment; filename="'+safe+'"',"Cache-Control":"private, no-store",
    "X-Content-Type-Options":"nosniff","Content-Security-Policy":"sandbox"}});
  }catch{return reply({error:"Không truy cập được file"},503);}
 }
 if(request.method==="GET"){
  const imported=await historicalNotes(user.accessToken);
  if(!db)return reply({ok:true,storage_ready:false,notes:imported,warning:"D1 chưa cấu hình"});
  try{
   const q="SELECT id,local_date,issued_at_vn,valid_from_vn,valid_until_vn,issuer,area,summary,source_reference,attachment_name,attachment_sha256,created_by,created_at_vn FROM marine_forecast_bulletins ORDER BY issued_at_vn DESC LIMIT 75";
   const rows=(await db.prepare(q).all()).results||[];
   return reply({ok:true,storage_ready:true,notes:[...rows.map(summaryRow),...imported].sort((a,b)=>b.issued_at_vn.localeCompare(a.issued_at_vn))});
  }catch{return reply({ok:true,storage_ready:false,notes:imported,warning:"Bảng lưu bản tin chưa sẵn sàng"});}
 }
 if(request.method!=="POST")return reply({error:"Method not allowed"},405);
 if(request.headers.get("Origin")!==url.origin)return reply({error:"Origin không hợp lệ"},403);
 if(!request.headers.get("Content-Type")?.startsWith("multipart/form-data"))return reply({error:"Chỉ nhận FormData"},415);
 if(!db)return reply({error:"Kho file riêng chưa sẵn sàng. Không lưu giả."},503);
 try{
  const form=await request.formData();
  const issued=checkDate(String(form.get("issued_at")||""));
  const from=form.get("valid_from")?checkDate(String(form.get("valid_from"))):null;
  const until=form.get("valid_until")?checkDate(String(form.get("valid_until"))):null;
  const issuer=String(form.get("issuer")||"").trim(),area=String(form.get("area")||"").trim();
  const summary=String(form.get("summary")||"").trim(),sourceReference=String(form.get("source_reference")||"").trim();
  if(!issued||!issuer||issuer.length>120||!area||area.length>100||!summary||summary.length>600||sourceReference.length>160)
    return reply({error:"Cần ngày, nguồn, khu vực và tóm tắt (tối đa 600 ký tự)."},422);
  if(from&&until&&new Date(until)<new Date(from))return reply({error:"Ngày kết thúc nhỏ hơn ngày bắt đầu"},422);
  let name=null,mime=null,sha=null,bytes=null;
  const file=form.get("attachment");
  if(file&&typeof file.arrayBuffer==="function"&&file.size>0){
   mime=String(file.type||"");
   if(!["image/jpeg","image/png","image/webp","application/pdf"].includes(mime))return reply({error:"Chỉ hỗ trợ ảnh hoặc PDF"},415);
   if(file.size>3*1024*1024)return reply({error:"File phải nhỏ hơn 3 MB"},413);
   name=String(file.name||"bulletin").replace(/[^a-zA-Z0-9._-]/g,"_").slice(0,80);
   bytes=await file.arrayBuffer();
   const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",bytes));
   sha=[...digest].map(x=>x.toString(16).padStart(2,"0")).join("");
  }
  const day=issued.slice(0,10),count=await db.prepare("SELECT COUNT(*) AS n FROM marine_forecast_bulletins WHERE local_date=?").bind(day).first();
  if(Number(count?.n||0)>=10)return reply({error:"Ngày này đã có 10 bản tin"},409);
  const id=crypto.randomUUID(),now=timeVN(),sql="INSERT INTO marine_forecast_bulletins (id,local_date,issued_at_vn,valid_from_vn,valid_until_vn,issuer,area,summary,source_reference,attachment_name,attachment_mime,attachment_sha256,attachment_bytes,created_by,created_at_vn) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";
  await db.prepare(sql).bind(id,day,issued,from,until,issuer,area,summary,sourceReference||null,name,mime,sha,bytes,user.login,now).run();
  const saved=await db.prepare("SELECT id,attachment_sha256 FROM marine_forecast_bulletins WHERE id=?").bind(id).first();
  if(saved?.id!==id||saved?.attachment_sha256!==sha)return reply({error:"Không kiểm chứng được bản tin đã lưu"},503);
  return reply({ok:true,archived:true,id,date:day,has_attachment:!!bytes});
 }catch(e){return reply({error:"Không lưu được bản tin: "+(e?.message||String(e))},503);}
}
