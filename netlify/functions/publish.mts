import type { Config } from "@netlify/functions";
import { session, canWrite, github, REPO, BRANCH, roleFor, json } from "./_lib/cms.mts";
export default async (req:Request)=>{
  if(req.method!=="POST")return json({error:"Method not allowed"},405);
  const s=session(req);if(!s)return json({error:"Chưa đăng nhập"},401);
  try{
    const latestRole=await roleFor(s.accessToken,s.login);
    const body=await req.json() as any,path=String(body.path||"");
    if(!latestRole||!canWrite(latestRole,path))return json({error:"Vai trò hiện tại không được xuất bản module này"},403);
    if(!body.sha)return json({error:"Thiếu SHA phiên bản hiện tại"},409);
    let text:string;
    if(path.endsWith(".json")){text=JSON.stringify(body.content,null,2)+"\n";JSON.parse(text)}else text=String(body.content??"");
    if(text.length>1200000)return json({error:"Nội dung vượt giới hạn CMS"},413);
    const result=await github(`/repos/${REPO}/contents/${path}`,s.accessToken,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:String(body.message||"cms: update content"),content:Buffer.from(text,"utf8").toString("base64"),sha:body.sha,branch:BRANCH})});
    return json({ok:true,sha:result.content?.sha||null,commit:result.commit?.sha||null});
  }catch(e:any){return json({error:e.message||String(e)},500)}
};
export const config:Config={path:"/api/cms/publish"};
