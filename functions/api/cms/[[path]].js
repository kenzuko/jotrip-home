const REPO="kenzuko/jotrip-home";
const BRANCH="main";
const SESSION_COOKIE="openpq_cms";
const STATE_COOKIE="openpq_oauth_state";

const readablePaths={
  "data/home-copy.json":["admin","editor","operator","viewer"],
  "data/content.json":["admin","editor","operator","viewer"],
  "guide/data.json":["admin","editor","operator","viewer"],
  "data/utilities.json":["admin","editor","operator","viewer"],
  "cms/users.json":["admin"]
};
const writablePaths={
  "data/home-copy.json":["admin","editor"],
  "data/content.json":["admin","editor"],
  "guide/data.json":["admin","editor"],
  "data/utilities.json":["admin","operator"],
  "cms/users.json":["admin"]
};

const te=new TextEncoder(),td=new TextDecoder();
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",...headers}});
const parseCookies=req=>{const out={};for(const part of (req.headers.get("cookie")||"").split(";")){const i=part.indexOf("=");if(i>0)out[part.slice(0,i).trim()]=decodeURIComponent(part.slice(i+1).trim())}return out};
const cookie=(name,value,maxAge)=>`${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
const clearCookie=name=>cookie(name,"",0);
const toStdB64=u8=>{let s="";for(const b of u8)s+=String.fromCharCode(b);return btoa(s)};
const toB64=u8=>toStdB64(u8).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const fromB64=s=>{s=s.replace(/-/g,"+").replace(/_/g,"/");while(s.length%4)s+="=";const bin=atob(s);return Uint8Array.from(bin,c=>c.charCodeAt(0))};

async function aesKey(secret){
  const digest=await crypto.subtle.digest("SHA-256",te.encode(secret));
  return crypto.subtle.importKey("raw",digest,{name:"AES-GCM"},false,["encrypt","decrypt"]);
}
async function seal(obj,secret){
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await aesKey(secret);
  const enc=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},key,te.encode(JSON.stringify(obj))));
  return toB64(iv)+"."+toB64(enc);
}
async function unseal(token,secret){
  if(!token||!secret)return null;
  try{
    const [a,b]=token.split(".");if(!a||!b)return null;
    const key=await aesKey(secret);
    const dec=await crypto.subtle.decrypt({name:"AES-GCM",iv:fromB64(a)},key,fromB64(b));
    const obj=JSON.parse(td.decode(dec));
    if(!obj.exp||Date.now()>obj.exp)return null;
    return obj;
  }catch{return null}
}
async function gh(path,token,init={}){
  const r=await fetch("https://api.github.com"+path,{...init,headers:{Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28",Authorization:`Bearer ${token}`,...(init.headers||{})}});
  const text=await r.text();let data;try{data=JSON.parse(text)}catch{data=text}
  if(!r.ok)throw new Error(data?.message||`GitHub HTTP ${r.status}`);
  return data;
}
async function roleFor(token,login){
  const f=await gh(`/repos/${REPO}/contents/cms/users.json?ref=${BRANCH}`,token);
  const raw=td.decode(Uint8Array.from(atob(String(f.content||"").replace(/\s/g,"")),c=>c.charCodeAt(0)));
  const doc=JSON.parse(raw);
  const u=(doc.users||[]).find(x=>String(x.login).toLowerCase()===String(login).toLowerCase()&&x.enabled!==false);
  return u?.role||null;
}
const canRead=(role,path)=>(readablePaths[path]||[]).includes(role);
const canWrite=(role,path)=>(writablePaths[path]||[]).includes(role);

async function getSession(req,env){
  return unseal(parseCookies(req)[SESSION_COOKIE]||"",env.CMS_SESSION_SECRET||"");
}
function responseWithCookies(location,cookies){
  const h=new Headers({Location:location,"Cache-Control":"no-store"});
  for(const c of cookies)h.append("Set-Cookie",c);
  return new Response(null,{status:302,headers:h});
}

async function auth(req,env,url){
  const action=url.searchParams.get("action")||"login";
  if(action==="logout")return json({ok:true},200,{"Set-Cookie":clearCookie(SESSION_COOKIE)});
  if(!env.GITHUB_OAUTH_CLIENT_ID||!env.GITHUB_OAUTH_CLIENT_SECRET||!env.CMS_SESSION_SECRET)return json({error:"CMS OAuth chưa được cấu hình"},503);

  if(action==="login"){
    const bytes=crypto.getRandomValues(new Uint8Array(24)),state=toB64(bytes);
    const callback=`${url.origin}/api/cms/auth?action=callback`;
    const u=new URL("https://github.com/login/oauth/authorize");
    u.searchParams.set("client_id",env.GITHUB_OAUTH_CLIENT_ID);
    u.searchParams.set("redirect_uri",callback);
    u.searchParams.set("scope","public_repo read:user");
    u.searchParams.set("state",state);
    u.searchParams.set("allow_signup","false");
    return responseWithCookies(u.toString(),[cookie(STATE_COOKIE,state,600)]);
  }

  if(action==="callback"){
    const code=url.searchParams.get("code")||"",state=url.searchParams.get("state")||"",stored=parseCookies(req)[STATE_COOKIE]||"";
    if(!code||!state||!stored||state!==stored)return json({error:"OAuth state không hợp lệ"},400,{"Set-Cookie":clearCookie(STATE_COOKIE)});
    const callback=`${url.origin}/api/cms/auth?action=callback`;
    const tr=await fetch("https://github.com/login/oauth/access_token",{method:"POST",headers:{Accept:"application/json","Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:env.GITHUB_OAUTH_CLIENT_ID,client_secret:env.GITHUB_OAUTH_CLIENT_SECRET,code,redirect_uri:callback})});
    const tb=await tr.json();
    if(!tr.ok||!tb.access_token)return json({error:"Không lấy được GitHub access token"},401);
    const user=await gh("/user",tb.access_token);
    const role=await roleFor(tb.access_token,user.login);
    if(!role)return json({error:"Tài khoản GitHub này chưa được cấp quyền CMS"},403);
    const token=await seal({login:user.login,name:user.name||user.login,avatar:user.avatar_url||null,role,accessToken:tb.access_token,exp:Date.now()+12*60*60*1000},env.CMS_SESSION_SECRET);
    return responseWithCookies("/admin/",[cookie(SESSION_COOKIE,token,12*60*60),clearCookie(STATE_COOKIE)]);
  }
  return json({error:"Action không hợp lệ"},400);
}

export async function onRequest(context){
  const {request,env,params}=context;
  const parts=Array.isArray(params.path)?params.path:[params.path].filter(Boolean);
  const endpoint=parts[0]||"";
  const url=new URL(request.url);

  try{
    if(endpoint==="auth")return auth(request,env,url);

    if(!env.CMS_SESSION_SECRET)return json({error:"CMS backend chưa được cấu hình"},503);
    const s=await getSession(request,env);
    if(!s)return json({error:"Chưa đăng nhập"},401);

    if(endpoint==="session")return json({login:s.login,name:s.name,avatar:s.avatar,role:s.role,exp:s.exp});

    if(endpoint==="content"){
      const path=url.searchParams.get("path")||"";
      if(!canRead(s.role,path))return json({error:"Không có quyền đọc module này"},403);
      const f=await gh(`/repos/${REPO}/contents/${path}?ref=${BRANCH}`,s.accessToken);
      const raw=td.decode(Uint8Array.from(atob(String(f.content||"").replace(/\s/g,"")),c=>c.charCodeAt(0)));
      return json({path,sha:f.sha,content:path.endsWith(".json")?JSON.parse(raw):raw});
    }

    if(endpoint==="publish"){
      if(request.method!=="POST")return json({error:"Method not allowed"},405);
      const latestRole=await roleFor(s.accessToken,s.login);
      const body=await request.json(),path=String(body.path||"");
      if(!latestRole||!canWrite(latestRole,path))return json({error:"Vai trò hiện tại không được xuất bản module này"},403);
      if(!body.sha)return json({error:"Thiếu SHA phiên bản hiện tại"},409);
      let text=path.endsWith(".json")?JSON.stringify(body.content,null,2)+"\n":String(body.content??"");
      if(path.endsWith(".json"))JSON.parse(text);
      if(text.length>1200000)return json({error:"Nội dung vượt giới hạn CMS"},413);
      const result=await gh(`/repos/${REPO}/contents/${path}`,s.accessToken,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:String(body.message||"cms: update content"),content:toStdB64(te.encode(text)),sha:body.sha,branch:BRANCH})});
      return json({ok:true,sha:result.content?.sha||null,commit:result.commit?.sha||null});
    }

    return json({error:"Không tìm thấy API"},404);
  }catch(e){
    return json({error:e?.message||String(e)},500);
  }
}
