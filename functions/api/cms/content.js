import { readCmsSession, readCurrentCmsRole } from "../../_shared/cms-mutation-core.js";
import { cmsCan } from "../../_shared/cms-mutation-policy.js";
const te=new TextEncoder();

const json=(data,status=200)=>new Response(JSON.stringify(data),{
  status,
  headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}
});

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
    const s=await readCmsSession(request,String(env.CMS_SESSION_SECRET||""));
    if(!s)return json({error:"Chưa đăng nhập"},401);

    const url=new URL(request.url);
    const path=url.searchParams.get("path")||"";
    const role=await readCurrentCmsRole(s.login,{cacheBustKey:"v",
      failureMessage:"Không kiểm tra được quyền CMS",includeHttpStatus:true});
    if(!cmsCan(role,path,"read"))return json({error:"Không có quyền đọc module này"},403);

    const text=await rawFile(path);
    const sha=await gitBlobSha(text);
    const content=path.endsWith(".json")?JSON.parse(text):text;
    return json({path,sha,content});
  }catch(e){
    return json({error:e?.message||String(e)},500);
  }
}
