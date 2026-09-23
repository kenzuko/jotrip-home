const SESSION_COOKIE="openpq_cms";
const te=new TextEncoder(),td=new TextDecoder();

const readable={
  "data/home-copy.json":["admin","editor","operator","viewer"],
  "data/content.json":["admin","editor","operator","viewer"],
  "guide/data.json":["admin","editor","operator","viewer"],
  "data/utilities.json":["admin","editor","operator","viewer"],
  "data/entities/destination-venues.json":["admin","editor","operator","viewer"],
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

async function currentRole(login){
  const r=await fetch("https://raw.githubusercontent.com/kenzuko/jotrip-home/main/cms/users.json?v="+Date.now(),{
    headers:{"User-Agent":"Open-Phu-Quoc-CMS"},cache:"no-store"
  });
  if(!r.ok)throw new Error("Không kiểm tra được quyền CMS: HTTP "+r.status);
  const doc=await r.json();
  const u=(doc.users||[]).find(x=>String(x.login).toLowerCase()===String(login).toLowerCase()&&x.enabled!==false);
  return u?.role||null;
}

async function rawFile(path){
  const safe=path.split("/").map(encodeURIComponent).join("/");
  const r=await fetch("https://raw.githubusercontent.com/kenzuko/jotrip-home/main/"+safe+"?v="+Date.now(),{
    headers:{"User-Agent":"Open-Phu-Quoc-CMS"},
    cache:"no-store"
  });
  if(!r.ok)throw new Error("Không tải được dữ liệu nội dung: HTTP "+r.status);
  return r.text();
}

async function gitBlobSha(text){
  const bytes=te.encode(text);
  const prefix=te.encode("blob "+bytes.length+"\0");
  const all=new Uint8Array(prefix.length+bytes.length);
  all.set(prefix,0);all.set(bytes,prefix.length);
  const digest=new Uint8Array(await crypto.subtle.digest("SHA-1",all));
  return [...digest].map(b=>b.toString(16).padStart(2,"0")).join("");
}

export async function onRequest({request,env}){
  try{
    const s=await session(request,String(env.CMS_SESSION_SECRET||""));
    if(!s)return json({error:"Chưa đăng nhập"},401);

    const url=new URL(request.url);
    const path=url.searchParams.get("path")||"";
    const role=await currentRole(s.login);
    if(!role||!(readable[path]||[]).includes(role))return json({error:"Không có quyền đọc module này"},403);

    const text=await rawFile(path);
    const sha=await gitBlobSha(text);
    const content=path.endsWith(".json")?JSON.parse(text):text;
    return json({path,sha,content});
  }catch(e){
    return json({error:e?.message||String(e)},500);
  }
}
