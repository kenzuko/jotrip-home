import { createHash, createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";

export const REPO="kenzuko/jotrip-home";
export const BRANCH="main";
export const SESSION_COOKIE="openpq_cms";
export const STATE_COOKIE="openpq_oauth_state";
export const allowedPaths:Record<string,string[]>={
  "data/home-copy.json":["admin","editor"],
  "data/content.json":["admin","editor"],
  "guide/data.json":["admin","editor"],
  "data/utilities.json":["admin","operator"],
  "cms/users.json":["admin"]
};

const env=(k:string)=>Netlify.env.get(k)||"";
const b64u=(b:Buffer)=>b.toString("base64url");
const key=()=>createHash("sha256").update(env("CMS_SESSION_SECRET")).digest();

export function cookieMap(req:Request){
  const raw=req.headers.get("cookie")||"";
  const out:Record<string,string>={};
  for(const part of raw.split(";")){const i=part.indexOf("=");if(i>0)out[part.slice(0,i).trim()]=decodeURIComponent(part.slice(i+1).trim())}
  return out;
}
export function setCookie(name:string,value:string,maxAge:number){
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
export function clearCookie(name:string){return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`}

export function seal(data:any){
  if(!env("CMS_SESSION_SECRET"))throw new Error("CMS_SESSION_SECRET_MISSING");
  const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",key(),iv);
  const enc=Buffer.concat([cipher.update(JSON.stringify(data),"utf8"),cipher.final()]);
  const tag=cipher.getAuthTag();
  return [b64u(iv),b64u(tag),b64u(enc)].join(".");
}
export function unseal(token:string){
  if(!token||!env("CMS_SESSION_SECRET"))return null;
  try{
    const [a,b,c]=token.split(".");if(!a||!b||!c)return null;
    const iv=Buffer.from(a,"base64url"),tag=Buffer.from(b,"base64url"),enc=Buffer.from(c,"base64url");
    const d=createDecipheriv("aes-256-gcm",key(),iv);d.setAuthTag(tag);
    const obj=JSON.parse(Buffer.concat([d.update(enc),d.final()]).toString("utf8"));
    if(!obj.exp||Date.now()>obj.exp)return null;
    return obj;
  }catch{return null}
}
export function session(req:Request){return unseal(cookieMap(req)[SESSION_COOKIE]||"")}
export function publicSession(s:any){return s?{login:s.login,name:s.name,avatar:s.avatar,role:s.role,exp:s.exp}:null}

export async function github(path:string,token:string,init:RequestInit={}){
  const r=await fetch("https://api.github.com"+path,{...init,headers:{Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28",Authorization:`Bearer ${token}`,...(init.headers||{})}});
  const body=await r.text();let data:any;try{data=JSON.parse(body)}catch{data=body}
  if(!r.ok)throw new Error(data?.message||`GitHub HTTP ${r.status}`);
  return data;
}
export async function roleFor(token:string,login:string){
  const f=await github(`/repos/${REPO}/contents/cms/users.json?ref=${BRANCH}`,token);
  const raw=Buffer.from(String(f.content||"").replace(/\s/g,""),"base64").toString("utf8");
  const doc=JSON.parse(raw);
  const u=(doc.users||[]).find((x:any)=>String(x.login).toLowerCase()===String(login).toLowerCase()&&x.enabled!==false);
  return u?.role||null;
}
export function canWrite(role:string,path:string){return (allowedPaths[path]||[]).includes(role)}
export function canRead(role:string,path:string){return path in allowedPaths && ["admin","editor","operator","viewer"].includes(role)}
export function json(data:any,status=200,headers:Record<string,string>={}){return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",...headers}})}
