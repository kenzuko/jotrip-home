import type { Config } from "@netlify/functions";
import { session, canRead, github, REPO, BRANCH, json } from "./_lib/cms.mts";
export default async (req:Request)=>{
  const s=session(req);if(!s)return json({error:"Chưa đăng nhập"},401);
  const url=new URL(req.url),path=url.searchParams.get("path")||"";
  if(!canRead(s.role,path))return json({error:"Không có quyền đọc module này"},403);
  try{
    const f=await github(`/repos/${REPO}/contents/${path}?ref=${BRANCH}`,s.accessToken);
    const raw=Buffer.from(String(f.content||"").replace(/\s/g,""),"base64").toString("utf8");
    const content=path.endsWith(".json")?JSON.parse(raw):raw;
    return json({path,sha:f.sha,content});
  }catch(e:any){return json({error:e.message||String(e)},500)}
};
export const config:Config={path:"/api/cms/content"};
