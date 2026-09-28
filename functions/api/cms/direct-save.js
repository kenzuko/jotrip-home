/* Direct text-only publishing for an authenticated CMS admin.
 * One atomic Git tree update on main, never a blind overwrite or public-client token. */
const REPO="kenzuko/jotrip-home",HOST="https://api.github.com/repos/"+REPO;
const COOKIE="openpq_cms",enc=new TextEncoder(),dec=new TextDecoder();
const ALLOWED=new Set(["data/content.json","data/i18n/vi/food.json",
  "data/knowledge/objects.json","data/home-copy.json"]);
const homeSections=new Set(["happening","things","must","areas","food","essentials","heritage","guide"]);
function json(body,status=200){return new Response(JSON.stringify(body),{status,
  headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"private, no-store","Vary":"Cookie"}});}
function b64bytes(raw){
  let s=String(raw||"").replace(/-/g,"+").replace(/_/g,"/");
  while(s.length%4)s+="=";
  return Uint8Array.from(atob(s),c=>c.charCodeAt(0));
}
function cookies(req){
  const piece=(req.headers.get("cookie")||"").split(";").map(x=>x.trim())
    .find(x=>x.startsWith(COOKIE+"="));
  if(!piece)return "";
  try{return decodeURIComponent(piece.slice(COOKIE.length+1));}catch{return "";}
}
async function session(req,secret){
  if(!secret)return null;
  const token=cookies(req);if(!token)return null;
  try{
    const [a,b]=token.split(".");
    if(!a||!b)return null;
    const digest=await crypto.subtle.digest("SHA-256",enc.encode(secret));
    const key=await crypto.subtle.importKey("raw",digest,{name:"AES-GCM"},false,["decrypt"]);
    const clear=await crypto.subtle.decrypt({name:"AES-GCM",iv:b64bytes(a)},key,b64bytes(b));
    const s=JSON.parse(dec.decode(clear));
    return s.exp>Date.now()&&s.accessToken?s:null;
  }catch{return null;}
}
async function role(login){
  const res=await fetch("https://raw.githubusercontent.com/"+REPO+
    "/main/cms/users.json?at="+Date.now(),{headers:{"User-Agent":"Open-Phu-Quoc-CMS"},cache:"no-store"});
  if(!res.ok)throw Object.assign(Error("Không xác minh được quyền CMS"),{code:503});
  const data=await res.json();
  return (data.users||[]).find(x=>String(x.login).toLowerCase()===String(login).toLowerCase()&&x.enabled!==false)?.role||null;
}
function ghHeaders(token){return{
  Accept:"application/vnd.github+json",
  "Content-Type":"application/json",
  "X-GitHub-Api-Version":"2022-11-28",
  "User-Agent":"Open-Phu-Quoc-CMS",
  Authorization:"Bearer "+token
};}
async function gh(path,token,opts={}){
  const res=await fetch(HOST+path,{...opts,headers:ghHeaders(token),cache:"no-store"});
  const value=await res.json().catch(()=>({}));
  if(!res.ok)throw Object.assign(Error(value.message||"GitHub HTTP "+res.status),
    {code:res.status===401||res.status===403?res.status:res.status===422?409:502});
  return {value,link:res.headers.get("link")||""};
}
async function atMain(path,ref,token){
  const clean=path.split("/").map(encodeURIComponent).join("/");
  const {value}=await gh("/contents/"+clean+"?ref="+encodeURIComponent(ref),token);
  if(value.encoding!=="base64"||!value.sha||!value.content)
    throw Object.assign(Error("Tệp dữ liệu chưa thể đọc trọn vẹn"),{code:502});
  const text=dec.decode(b64bytes(String(value.content).replace(/\s/g,"")));
  return {sha:value.sha,content:JSON.parse(text)};
}
function fieldOK(path,record,field){
  if(!record||typeof record!=="object"||!field||field.includes("__proto__")||
     field.includes("constructor")||field.includes("prototype"))return false;
  if(path==="data/content.json"){
    if(["title","dek","intro"].includes(field))return true;
    const match=/^sections\.(0|[1-9]\d*)\.(heading|body)$/.exec(field);
    return Boolean(match&&Array.isArray(record.sections)&&Number(match[1])<record.sections.length);
  }
  if(path==="data/i18n/vi/food.json"){
    if(["name","intro","origin","why_name","how_to_eat","allergy_note"].includes(field))
      return Object.hasOwn(record,field)&&typeof record[field]==="string";
    const m=/^(ingredients|tips|ask_staff)\.(0|[1-9]\d*)$/.exec(field);
    return Boolean(m&&Array.isArray(record[m[1]])&&Number(m[2])<record[m[1]].length);
  }
  if(path==="data/knowledge/objects.json"){
    if(field==="title")return true;
    if(["editorial.short_summary","editorial.practical","editorial.expectation_vs_reality"].includes(field))return true;
    const m=/^editorial\.before_you_go\.(0|[1-9]\d*)$/.exec(field);
    return Boolean(m&&Array.isArray(record.editorial?.before_you_go)&&
      Number(m[1])<record.editorial.before_you_go.length);
  }
  if(path==="data/home-copy.json"){
    if(["hero.kicker","hero.title","hero.lead"].includes(field))return true;
    const m=/^sections\.([a-z]+)\.(eyebrow|title|lead)$/.exec(field);
    return Boolean(m&&homeSections.has(m[1])&&
      Object.hasOwn(record.sections||{},m[1])&&Object.hasOwn(record.sections[m[1]],m[2]));
  }
  return false;
}
function locate(payload,path,id){
  if(path==="data/home-copy.json")return id==="home"?payload:null;
  const keys={"data/content.json":["stories","id"],"data/i18n/vi/food.json":["dishes","id"],
    "data/knowledge/objects.json":["objects","topic_id"]};
  const [list,key]=keys[path]||[];
  return Array.isArray(payload[list])?payload[list].find(x=>x[key]===id):null;
}
function get(record,path){
  return String(path.split(".").reduce((v,k)=>v?.[k],record)??"");
}
function set(record,path,value){
  const keys=path.split(".");
  let node=record;
  for(let i=0;i<keys.length-1;i++)node=node[keys[i]];
  node[keys.at(-1)]=value;
}
function validate(doc,path,id){
  const current=locate(doc,path,id);
  if(!current)return "Bài hoặc trang nguồn đã bị xóa";
  if(path==="data/content.json"){
    if(!String(current.title||"").trim()||!Array.isArray(current.sections)||
      current.sections.length===0)return "Bài viết cần tiêu đề và ít nhất một đoạn";
  }else if(path==="data/i18n/vi/food.json"){
    if(doc.locale!=="vi"||doc.dishes?.length!==32)return "Kho món ăn phải đủ 32 bài tiếng Việt";
    if(!String(current.name||"").trim()||!String(current.intro||"").trim())
      return "Bài món ăn cần tên và lời mở";
  }else if(path==="data/knowledge/objects.json"){
    if(!String(current.title||"").trim()||
       !String(current.editorial?.short_summary||"").trim()||
       !String(current.editorial?.practical||"").trim()||
       !Array.isArray(current.editorial?.before_you_go)||!current.editorial.before_you_go.length)
      return "Bài cẩm nang thiếu thông tin công bố bắt buộc";
  }else if(path==="data/home-copy.json"){
    if(!String(doc.hero?.title||"").trim()||!String(doc.hero?.lead||"").trim())
      return "Trang chủ cần tiêu đề và lời dẫn";
  }
  return "";
}
async function conflicts(paths,token){
  const {value:pulls,link}=await gh("/pulls?state=open&per_page=100&sort=updated&direction=desc",token);
  if(!Array.isArray(pulls)||/rel="next"/.test(link))
    throw Object.assign(Error("Chưa thể kiểm tra toàn bộ đề xuất đang mở"),{code:409});
  for(let i=0;i<pulls.length;i+=3){
    const checked=await Promise.all(pulls.slice(i,i+3).map(async pr=>{
      const listing=await gh("/pulls/"+pr.number+"/files?per_page=100",token);
      if(!Array.isArray(listing.value)||/rel="next"/.test(listing.link))
        throw Object.assign(Error("Đề xuất #"+pr.number+" có quá nhiều tệp để kiểm tra"),{code:409});
      return {pr,files:listing.value};
    }));
    const hit=checked.find(item=>item.files.some(f=>paths.includes(f.filename)));
    if(hit)throw Object.assign(Error("Đề xuất #"+hit.pr.number+
      " đang sửa cùng tệp. Hoàn tất hoặc đóng đề xuất đó trước khi lưu trực tiếp."),
      {code:409,pr_url:hit.pr.html_url});
  }
}
async function onRequestInner({request,env}){
  if(request.method!=="POST")return json({error:"Chỉ hỗ trợ POST"},405);
  // Publishing is privileged. No wildcard CORS or cross-site POST.
  if(request.headers.get("Origin")!==new URL(request.url).origin)
    return json({error:"Origin không hợp lệ"},403);
  const s=await session(request,String(env.CMS_SESSION_SECRET||""));
  if(!s)return json({error:"Hết phiên, hãy đăng nhập CMS lại"},401);
  const userRole=await role(s.login);
  if(userRole!=="admin")return json({error:"Chỉ Admin được lưu trực tiếp"},403);
  const body=await request.json();
  const path=String(body?.path||""),id=String(body?.record_id||"");
  const expectedSha=String(body?.sha||"");
  const changes=body?.changes;
  if(!ALLOWED.has(path)||!id||id.length>180||
     !/^[a-f0-9]{40}$/.test(expectedSha)||!Array.isArray(changes)||
     changes.length<1||changes.length>60||JSON.stringify(body).length>80000)
    return json({error:"Yêu cầu sửa chữ không hợp lệ"},400);
  const seen=new Set();
  for(const item of changes){
    if(!item||typeof item.field!=="string"||seen.has(item.field)||
       typeof item.before!=="string"||typeof item.after!=="string"||
       item.after.length>14000||item.after.includes("\u0000"))
      return json({error:"Nội dung chỉnh sửa không hợp lệ hoặc bị trùng"},422);
    seen.add(item.field);
  }
  const token=s.accessToken;
  const currentRef=(await gh("/git/ref/heads/main",token)).value.object?.sha;
  if(!/^[a-f0-9]{40}$/.test(currentRef||""))
    return json({error:"Chưa đọc được phiên bản main"},502);
  const source=await atMain(path,currentRef,token);
  if(source.sha!==expectedSha)
    return json({error:"Nội dung đã thay đổi trên GitHub. Nháp vẫn được giữ để đối chiếu.",
      latest_sha:source.sha},409);
  const target=locate(source.content,path,id);
  if(!target)return json({error:"Không tìm thấy đúng bài đang đọc"},404);
  for(const item of changes){
    if(!fieldOK(path,target,item.field))
      return json({error:"Chỉ cho phép sửa chữ đã gắn đúng trường nội dung"},422);
    if(get(target,item.field)!==item.before)
      return json({error:"Nội dung gốc không khớp. Không ghi đè thay đổi từ nơi khác."},409);
  }
  const mirrorPath=path==="data/i18n/vi/food.json"?"data/food.json":null;
  const mirror=mirrorPath?await atMain(mirrorPath,currentRef,token):null;
  if(mirror&&JSON.stringify(mirror.content.dishes)!==JSON.stringify(source.content.dishes))
    return json({error:"Hai nguồn món ăn đang lệch. Chưa thể lưu trực tiếp."},409);
  const paths=mirror?[path,mirrorPath]:[path];
  await conflicts(paths,token);
  for(const item of changes)set(target,item.field,item.after);
  const problem=validate(source.content,path,id);
  if(problem)return json({error:problem},422);
  if(changes.every(item=>item.before===item.after))
    return json({ok:true,unchanged:true,sha:source.sha},200);
  const files=[{path,data:source.content}];
  if(mirror){
    mirror.content.dishes=source.content.dishes;
    files.push({path:mirrorPath,data:mirror.content});
  }
  // Atomic multi-file Git commit. A concurrent main advance prevents non-fast-forward ref update.
  const newBlob=await Promise.all(files.map(async item=>{
    const value=(await gh("/git/blobs",token,{method:"POST",
      body:JSON.stringify({content:JSON.stringify(item.data,null,2)+"\n",encoding:"utf-8"})})).value;
    return {path:item.path,mode:"100644",type:"blob",sha:value.sha};
  }));
  const commit=(await gh("/git/commits/"+currentRef,token)).value;
  if(!commit.tree?.sha)return json({error:"Thiếu Git tree gốc"},502);
  const tree=(await gh("/git/trees",token,{method:"POST",
    body:JSON.stringify({base_tree:commit.tree.sha,tree:newBlob})})).value;
  const safeId=id.replace(/[^a-zA-Z0-9_ -]/g,"").slice(0,45);
  const saved=(await gh("/git/commits",token,{method:"POST",
    body:JSON.stringify({message:"cms(admin): sửa chữ trực tiếp "+safeId+
      "\n\nAdmin: @"+s.login+"\nFile: "+path+
      "\nFields: "+changes.map(x=>x.field).join(", "),
      tree:tree.sha,parents:[currentRef]})})).value;
  try{
    await gh("/git/refs/heads/main",token,{method:"PATCH",
      body:JSON.stringify({sha:saved.sha,force:false})});
  }catch(err){
    return json({error:err.code===403?
      "GitHub không cho phép ghi thẳng vào main. Bản nháp còn nguyên, có thể gửi PR thay thế.":
      "GitHub đã thay đổi hoặc từ chối bản ghi. Nháp còn nguyên, không ghi đè.",
      detail:err.message},err.code===403?403:409);
  }
  return json({ok:true,commit:saved.sha,record_id:id,changed_fields:changes.map(x=>x.field),
    message:"Đã lưu lên main. Chờ hệ thống phát hành để khách thấy bản mới.",
    deployment_pending:true,files:paths});
}
export async function onRequest(ctx){
  try{return await onRequestInner(ctx);}
  catch(err){return json({error:err?.message||"Không thể lưu trực tiếp",
    ...(err?.pr_url?{conflicting_pr:err.pr_url}:{})},err?.code||502);}
}
export const DIRECT_SAVE_TEST={fieldOK,locate,get,set,validate};
