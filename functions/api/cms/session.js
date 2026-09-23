const SESSION_COOKIE="openpq_cms";
const te=new TextEncoder(),td=new TextDecoder();

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

async function session(req,secret){
  const token=parseCookies(req)[SESSION_COOKIE]||"";
  if(!token||!secret)return null;
  try{
    const [a,b]=token.split(".");
    if(!a||!b)return null;
    const digest=await crypto.subtle.digest("SHA-256",te.encode(secret));
    const key=await crypto.subtle.importKey("raw",digest,{name:"AES-GCM"},false,["decrypt"]);
    const dec=await crypto.subtle.decrypt({name:"AES-GCM",iv:fromB64(a)},key,fromB64(b));
    const obj=JSON.parse(td.decode(dec));
    return obj.exp>Date.now()?obj:null;
  }catch{return null}
}

async function currentRole(login){
  const r=await fetch("https://raw.githubusercontent.com/kenzuko/jotrip-home/main/cms/users.json?v="+Date.now(),{
    headers:{"User-Agent":"Open-Phu-Quoc-CMS"},
    cache:"no-store"
  });
  if(!r.ok)throw new Error("Không kiểm tra được quyền CMS: HTTP "+r.status);
  const doc=await r.json();
  const u=(doc.users||[]).find(x=>String(x.login).toLowerCase()===String(login).toLowerCase()&&x.enabled!==false);
  return u?.role||null;
}

export async function onRequest({request,env}){
  const s=await session(request,String(env.CMS_SESSION_SECRET||""));
  if(!s)return json({error:"Chưa đăng nhập"},401);
  try{
    const role=await currentRole(s.login);
    if(!role)return json({error:"Tài khoản CMS đã bị vô hiệu hóa"},401);
    return json({
      login:s.login,
      name:s.name,
      avatar:s.avatar||null,
      role,
      exp:s.exp
    });
  }catch(e){
    return json({error:"Không kiểm tra được quyền truy cập",detail:e?.message||String(e)},503);
  }
}
