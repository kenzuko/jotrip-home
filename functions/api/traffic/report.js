// Read-only CMS statistics. Never expose the D1 binding to the public browser.
import {trafficReport} from "../../_shared/traffic-analytics.js";
const cookie="openpq_cms",te=new TextEncoder(),td=new TextDecoder();
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
const b64=s=>Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(s.length/4)*4,"=")),c=>c.charCodeAt(0));
async function account(request,secret){
  if(!secret)return null;
  const jar=Object.fromEntries((request.headers.get("cookie")||"").split(";").map(s=>s.trim()).filter(s=>s.includes("=")).map(s=>[s.slice(0,s.indexOf("=")),s.slice(s.indexOf("=")+1)]));
  const token=decodeURIComponent(jar[cookie]||"");
  const [a,b]=token.split(".");
  if(!a||!b)return null;
  try{
    const digest=await crypto.subtle.digest("SHA-256",te.encode(secret));
    const key=await crypto.subtle.importKey("raw",digest,{name:"AES-GCM"},false,["decrypt"]);
    const raw=await crypto.subtle.decrypt({name:"AES-GCM",iv:b64(a)},key,b64(b));
    const user=JSON.parse(td.decode(raw));
    if(!user.login||!Number.isFinite(user.exp)||user.exp<Date.now())return null;
    return user;
  }catch{return null}
}
async function role(login){
  const response=await fetch("https://raw.githubusercontent.com/kenzuko/jotrip-home/main/cms/users.json",{headers:{"User-Agent":"Open-Phu-Quoc-CMS"},cache:"no-store"});
  if(!response.ok)throw Error("CMS role check unavailable");
  const doc=await response.json();
  return doc.users?.find(x=>x.enabled!==false&&String(x.login).toLowerCase()===String(login).toLowerCase())?.role||null;
}
export async function onRequestGet({request,env}){
  const user=await account(request,env.CMS_SESSION_SECRET);
  if(!user)return json({error:"Đăng nhập CMS để xem thống kê."},401);
  try{
    if(await role(user.login)!=="admin")return json({error:"Chỉ quản trị viên xem được thống kê truy cập."},403);
    return trafficReport(request,env);
  }catch(error){console.warn("Analytics auth unavailable",error);return json({error:"Chưa kiểm tra được quyền CMS."},503);}
}
