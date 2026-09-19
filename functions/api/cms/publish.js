const SESSION_COOKIE="openpq_cms";
const te=new TextEncoder(),td=new TextDecoder();

const writable={
  "data/home-copy.json":["admin","editor"],
  "data/content.json":["admin","editor"],
  "guide/data.json":["admin","editor"],
  "data/utilities.json":["admin","operator"],
  "cms/users.json":["admin"]
};

const json=(data,status=200)=>new Response(JSON.stringify(data),{
  status,
  headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}
});

const parseCookies=req=>{
  const out={};
  for(const part of (req.headers.get("cookie")||"").split(";")){
    const i=part.indexOf("=");
    if(i>0) out[part.slice(0,i).trim()]=decodeURIComponent(part.slice(i+1).trim());
  }
  return out;
};

const fromB64=s=>{
  s=s.replace(/-/g,"+").replace(/_/g,"/");
  while(s.length%4)s+="=";
  const bin=atob(s);
  return Uint8Array.from(bin,c=>c.charCodeAt(0));
};

const toStdB64=u8=>{
  let s="";
  for(const b of u8)s+=String.fromCharCode(b);
  return btoa(s);
};

async function key(secret){
  const digest=await crypto.subtle.digest("SHA-256",te.encode(secret));
  return crypto.subtle.importKey("raw",digest,{name:"AES-GCM"},false,["decrypt"]);
}

async function session(req,secret){
  const token=parseCookies(req)[SESSION_COOKIE]||"";
  if(!token||!secret)return null;
  try{
    const [a,b]=token.split(".");
    const k=await key(secret);
    const dec=await crypto.subtle.decrypt({name:"AES-GCM",iv:fromB64(a)},k,fromB64(b));
    const obj=JSON.parse(td.decode(dec));
    return obj.exp>Date.now()?obj:null;
  }catch{return null}
}

async function rawUsers(){
  const r=await fetch("https://raw.githubusercontent.com/kenzuko/jotrip-home/main/cms/users.json?v="+Date.now(),{
    headers:{"User-Agent":"Open-Phu-Quoc-CMS"},
    cache:"no-store"
  });
  if(!r.ok)throw new Error("Không tải được danh sách phân quyền: HTTP "+r.status);
  return r.json();
}

async function currentRole(login){
  const doc=await rawUsers();
  const u=(doc.users||[]).find(x=>String(x.login).toLowerCase()===String(login).toLowerCase()&&x.enabled!==false);
  return u?.role||null;
}

function validatePayload(path,content){
  const errors=[];

  if(!content||typeof content!=="object")return ["Dữ liệu không hợp lệ"];

  if(path==="data/home-copy.json"){
    if(!String(content?.hero?.title||"").trim())errors.push("Hero cần có tiêu đề");
    if(!String(content?.hero?.lead||"").trim())errors.push("Hero cần có đoạn dẫn");
  }

  if(path==="data/content.json"){
    const stories=Array.isArray(content.stories)?content.stories:[];
    if(!stories.length)errors.push("Cần ít nhất một bài viết");
    const ids=new Set();

    stories.forEach((story,i)=>{
      const id=String(story?.id||"").trim();
      const title=String(story?.title||"").trim();

      if(!title)errors.push("Bài #"+(i+1)+" chưa có tiêu đề");
      if(!id)errors.push("Bài #"+(i+1)+" chưa có mã bài");
      else if(ids.has(id))errors.push("Mã bài bị trùng: "+id);
      else ids.add(id);

      if(!Array.isArray(story?.sections)||!story.sections.length){
        errors.push("Bài "+(title||("#"+(i+1)))+" chưa có nội dung");
      }
    });
  }

  if(path==="guide/data.json"){
    if(!String(content?.title||"").trim())errors.push("Cẩm nang cần có tiêu đề");
  }

  if(path==="data/utilities.json"){
    const emergency=Array.isArray(content.national_emergency)?content.national_emergency:[];
    emergency.forEach((x,i)=>{
      if(!String(x?.label||"").trim()||!String(x?.phone||"").trim()){
        errors.push("Số khẩn cấp #"+(i+1)+" thiếu tên hoặc số điện thoại");
      }
    });
  }

  if(path==="cms/users.json"){
    const users=Array.isArray(content.users)?content.users:[];
    const activeAdmins=users.filter(x=>x?.role==="admin"&&x?.enabled!==false);
    if(!activeAdmins.length)errors.push("Phải còn ít nhất một Admin đang hoạt động");

    const seen=new Set();
    users.forEach((u,i)=>{
      const login=String(u?.login||"").trim().toLowerCase();
      if(!login)errors.push("Người dùng #"+(i+1)+" chưa có GitHub username");
      else if(seen.has(login))errors.push("GitHub username bị trùng: "+login);
      else seen.add(login);
    });
  }

  return errors;
}


export async function onRequest({request,env}){
  try{
    if(request.method!=="POST")return json({error:"Method not allowed"},405);
    const origin=request.headers.get("Origin");
    const expectedOrigin=new URL(request.url).origin;
    if(origin&&origin!==expectedOrigin)return json({error:"Origin không hợp lệ"},403);

    const s=await session(request,String(env.CMS_SESSION_SECRET||""));
    if(!s)return json({error:"Chưa đăng nhập"},401);

    const body=await request.json();
    const path=String(body.path||"");
    const role=await currentRole(s.login);
    if(!role||!(writable[path]||[]).includes(role))return json({error:"Vai trò hiện tại không được xuất bản module này"},403);
    if(!body.sha)return json({error:"Thiếu SHA phiên bản hiện tại"},409);

    const validationErrors=validatePayload(path,body.content);
    if(validationErrors.length)return json({error:"Dữ liệu chưa hợp lệ",detail:validationErrors.slice(0,5).join(" · ")},422);

    const text=path.endsWith(".json")?JSON.stringify(body.content,null,2)+"\n":String(body.content??"");
    if(path.endsWith(".json"))JSON.parse(text);
    if(text.length>1200000)return json({error:"Nội dung vượt giới hạn CMS"},413);

    const r=await fetch("https://api.github.com/repos/kenzuko/jotrip-home/contents/"+path,{
      method:"PUT",
      headers:{
        Accept:"application/vnd.github+json",
        "Content-Type":"application/json",
        "X-GitHub-Api-Version":"2022-11-28",
        Authorization:"Bearer "+s.accessToken,
        "User-Agent":"Open-Phu-Quoc-CMS"
      },
      body:JSON.stringify({
        message:String(body.message||"cms: update content").slice(0,120),
        content:toStdB64(te.encode(text)),
        sha:body.sha,
        branch:"main"
      })
    });

    const result=await r.json();
    if(!r.ok){
      return json({
        error:"GitHub publish failed",
        github_status:r.status,
        detail:result?.message||"Không rõ nguyên nhân"
      },r.status);
    }

    return json({ok:true,sha:result.content?.sha||null,commit:result.commit?.sha||null});
  }catch(e){
    return json({error:e?.message||String(e)},500);
  }
}
