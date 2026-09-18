import type { Context, Config } from "@netlify/functions";
import { randomBytes } from "node:crypto";
import { STATE_COOKIE, SESSION_COOKIE, cookieMap, setCookie, clearCookie, seal, github, roleFor, json } from "./_lib/cms.mts";

const env=(k:string)=>Netlify.env.get(k)||"";

export default async (req:Request,context:Context)=>{
  const url=new URL(req.url),action=url.searchParams.get("action")||"login";
  const clientId=env("GITHUB_OAUTH_CLIENT_ID"),clientSecret=env("GITHUB_OAUTH_CLIENT_SECRET");
  if(action==="logout"){
    return json({ok:true},200,{"Set-Cookie":clearCookie(SESSION_COOKIE)});
  }
  if(!clientId||!clientSecret)return json({error:"CMS OAuth chưa được cấu hình"},503);

  if(action==="login"){
    const state=randomBytes(24).toString("base64url");
    const callback=`${url.origin}/api/cms/auth?action=callback`;
    const auth=new URL("https://github.com/login/oauth/authorize");
    auth.searchParams.set("client_id",clientId);auth.searchParams.set("redirect_uri",callback);
    auth.searchParams.set("scope","public_repo read:user");auth.searchParams.set("state",state);auth.searchParams.set("allow_signup","false");
    return new Response(null,{status:302,headers:{Location:auth.toString(),"Set-Cookie":setCookie(STATE_COOKIE,state,600),"Cache-Control":"no-store"}});
  }

  if(action==="callback"){
    const code=url.searchParams.get("code")||"",state=url.searchParams.get("state")||"",stored=cookieMap(req)[STATE_COOKIE]||"";
    if(!code||!state||!stored||state!==stored)return json({error:"OAuth state không hợp lệ"},400,{"Set-Cookie":clearCookie(STATE_COOKIE)});
    const callback=`${url.origin}/api/cms/auth?action=callback`;
    const tr=await fetch("https://github.com/login/oauth/access_token",{method:"POST",headers:{Accept:"application/json","Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,code,redirect_uri:callback})});
    const tb=await tr.json() as any;if(!tr.ok||!tb.access_token)return json({error:"Không lấy được GitHub access token"},401);
    const user=await github("/user",tb.access_token);
    const role=await roleFor(tb.access_token,user.login);
    if(!role)return json({error:"Tài khoản GitHub này chưa được cấp quyền CMS"},403);
    const s=seal({login:user.login,name:user.name||user.login,avatar:user.avatar_url||null,role,accessToken:tb.access_token,exp:Date.now()+12*60*60*1000});
    return new Response(null,{status:302,headers:{Location:"/admin/","Set-Cookie":setCookie(SESSION_COOKIE,s,12*60*60),"Cache-Control":"no-store"}});
  }
  return json({error:"Action không hợp lệ"},400);
};
export const config:Config={path:"/api/cms/auth"};
