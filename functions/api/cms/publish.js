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
        message:String(body.message||"cms: update content"),
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
