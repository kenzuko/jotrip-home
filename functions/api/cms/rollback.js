import { CMS_REPO_API, createCmsMutationAudit, formatCmsMutationAudit, githubJson, readCmsSession, readCurrentCmsRole, sameOrigin } from "../../_shared/cms-mutation-core.js";
import { cmsCan, cmsCanAny, cmsCanRollbackDirectSave, cmsSupports } from "../../_shared/cms-mutation-policy.js";
const te=new TextEncoder(),td=new TextDecoder();
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
function fromB64(s){s=String(s||"").replace(/-/g,"+").replace(/_/g,"/");while(s.length%4)s+="=";const raw=atob(s);return Uint8Array.from(raw,c=>c.charCodeAt(0))}
function toB64(bytes){let raw="";for(const byte of bytes)raw+=String.fromCharCode(byte);return btoa(raw)}
async function gh(url,token,options={}){const {response,value}=await githubJson(url,token,options);if(!response.ok)throw Object.assign(new Error(value?.message||("GitHub HTTP "+response.status)),{status:response.status});return value}
function fail(message,status){return json({error:message},status)}
function validSha(value){return /^[a-f0-9]{40}$/.test(String(value||"").toLowerCase())}
function encodedPath(path){return String(path).split("/").map(encodeURIComponent).join("/")}
function parseShaPairs(value){
  const out={};
  for(const part of String(value||"").split(";")){
    const match=/^(.*)=([a-f0-9]{40})$/i.exec(part.trim());
    if(match&&match[1])out[match[1]]=match[2].toLowerCase();
  }
  return out;
}
function parseDirectSaveAudit(message){
  const lines=String(message||"").split(/\r?\n/),values={};
  if(!lines.some(line=>line.trim()==="OpenPQ-CMS-Mutation: v1"))return null;
  for(const line of lines){
    const i=line.indexOf(":");if(i<1)continue;
    values[line.slice(0,i).trim()]=line.slice(i+1).trim();
  }
  if(values["CMS-Operation"]!=="direct-save")return null;
  const paths=String(values["CMS-Paths"]||"").split(",").map(x=>x.trim()).filter(Boolean);
  const before=parseShaPairs(values["CMS-Before-File-SHAs"]),after=parseShaPairs(values["CMS-After-File-SHAs"]);
  const baseMain=String(values["CMS-Base-Main-SHA"]||"").toLowerCase();
  if(!paths.length||new Set(paths).size!==paths.length||!validSha(baseMain)||
     paths.some(path=>!validSha(before[path])||!validSha(after[path])))return null;
  if(Object.keys(before).length!==paths.length||Object.keys(after).length!==paths.length||
     Object.keys(before).some(path=>!paths.includes(path))||Object.keys(after).some(path=>!paths.includes(path)))return null;
  return{
    schema:"openpq-cms-mutation-v1",operation:"direct-save",
    actor:String(values["CMS-Actor"]||""),role:String(values["CMS-Role"]||"")||null,
    base_main_sha:baseMain,paths,before_file_shas:before,after_file_shas:after,
    changed_fields:String(values["CMS-Changed-Fields"]||"").split(",").map(x=>x.trim()).filter(Boolean),
    record_id:String(values["CMS-Record-ID"]||"")||null
  };
}
async function openPulls(token){return gh(CMS_REPO_API+"/pulls?state=open&per_page=100",token)}
async function proposePrRollback({user,role,number}){
  const base=CMS_REPO_API;
  const original=await gh(base+"/pulls/"+number,user.accessToken);
  if(!original.merged||!String(original.head?.ref||"").startsWith("cms/draft/"))return fail("Chỉ rollback được PR CMS đã merge",409);
  const open=await openPulls(user.accessToken);
  const existing=(Array.isArray(open)?open:[]).find(pr=>pr.title==="CMS: rollback #"+number);
  if(existing)return json({ok:true,existing:true,pull_request:{number:existing.number,url:existing.html_url}});
  const files=await gh(base+"/pulls/"+number+"/files?per_page=10",user.accessToken);
  if(files.length!==1||files[0].status!=="modified"||!cmsSupports(files[0].filename,"rollback"))return fail("PR này không phải thay đổi một tệp CMS có thể rollback an toàn tự động",422);
  const file=files[0];
  if(!cmsCan(role,file.filename,"rollback"))return fail("Chỉ Admin được tạo đề xuất rollback",403);
  const encoded=encodedPath(file.filename);
  const commit=await gh(base+"/commits/"+original.merge_commit_sha,user.accessToken);
  const parent=commit.parents?.[0]?.sha;
  if(!parent)return fail("Không tìm thấy phiên bản trước PR",409);
  const ref=await gh(base+"/git/ref/heads/main",user.accessToken);
  const current=await gh(base+"/contents/"+encoded+"?ref="+encodeURIComponent(ref.object.sha),user.accessToken);
  if(current.sha!==file.sha)return fail("Tệp đã thay đổi sau PR này. Tớ không tạo rollback tự động để tránh xóa sửa đổi mới.",409);
  const previous=await gh(base+"/contents/"+encoded+"?ref="+parent,user.accessToken);
  if(previous.encoding!=="base64"||!previous.content)return fail("Không đọc được phiên bản trước để tạo rollback",422);
  const safeLogin=String(user.login||"owner").toLowerCase().replace(/[^a-z0-9-]/g,"-").slice(0,24)||"owner";
  const branch="cms/draft/rollback-"+number+"-"+safeLogin+"-"+Date.now();
  await gh(base+"/git/refs",user.accessToken,{method:"POST",body:JSON.stringify({ref:"refs/heads/"+branch,sha:ref.object.sha})});
  const restoredText=td.decode(fromB64(previous.content));
  const write=await gh(base+"/contents/"+encoded,user.accessToken,{method:"PUT",body:JSON.stringify({
    message:"cms: propose rollback of #"+number,content:toB64(te.encode(restoredText)),sha:current.sha,branch
  })});
  const audit=createCmsMutationAudit({operation:"rollback-proposal",actor:user.login,role,baseMainSha:ref.object.sha,
    paths:[file.filename],beforeFileShas:{[file.filename]:current.sha},afterFileShas:{[file.filename]:write.content?.sha||null},
    branch,sourcePrNumber:number,mutationCommitSha:write.commit?.sha||null});
  const proposal=await gh(base+"/pulls",user.accessToken,{method:"POST",body:JSON.stringify({
    title:"CMS: rollback #"+number,head:branch,base:"main",draft:false,
    body:"## Đề xuất rollback CMS\n\n- PR nguồn: #"+number+"\n- Tệp: "+file.filename+"\n- Khôi phục nội dung ngay trước commit "+parent+".\n- Base main đã được kiểm tra khớp phiên bản do PR nguồn tạo.\n\nĐây vẫn là PR review; chưa public cho tới khi chủ CMS kiểm tra và merge.\n\n"+formatCmsMutationAudit(audit)
  })});
  return json({ok:true,pull_request:{number:proposal.number,url:proposal.html_url},file:file.filename,rollback_commit:write.commit?.sha||null,audit:{...audit,pull_request_number:proposal.number}});
}
async function proposeDirectSaveRollback({user,role,sourceSha}){
  const base=CMS_REPO_API,token=user.accessToken;
  const source=await gh(base+"/commits/"+sourceSha,token);
  const audit=parseDirectSaveAudit(source.commit?.message);
  if(!audit)return fail("Commit này không phải direct-save CMS có metadata rollback hợp lệ",422);
  if(!cmsCanRollbackDirectSave(role,audit.paths))return fail("Không được rollback direct-save này",403);
  const parents=Array.isArray(source.parents)?source.parents:[],parent=parents[0]?.sha;
  if(parents.length!==1||!validSha(parent)||parent!==audit.base_main_sha)return fail("Commit direct-save không khớp base main đã ghi trong audit",409);
  if(!Array.isArray(source.files))return fail("Không đọc được danh sách tệp của commit direct-save",502);
  const actualPaths=source.files.map(file=>String(file.filename||""));
  const actualUnit=actualPaths.length===audit.paths.length&&
    actualPaths.every(path=>audit.paths.includes(path))&&audit.paths.every(path=>actualPaths.includes(path));
  if(!actualUnit)return fail("Commit direct-save thực tế không khớp nhóm tệp đã ghi trong audit",409);
  for(const file of source.files){
    if(file.status!=="modified"||file.sha!==audit.after_file_shas[file.filename])
      return fail("Blob sau direct-save không khớp metadata audit",409);
  }
  const open=await openPulls(token);
  const title="CMS: rollback direct-save "+sourceSha;
  const existing=(Array.isArray(open)?open:[]).find(pr=>pr.title===title);
  if(existing)return json({ok:true,existing:true,pull_request:{number:existing.number,url:existing.html_url},source_direct_save_commit:sourceSha});
  const ref=await gh(base+"/git/ref/heads/main",token),mainSha=ref.object?.sha;
  if(!validSha(mainSha))return fail("Không đọc được phiên bản main hiện tại",502);
  const ancestry=await gh(base+"/compare/"+sourceSha+"..."+mainSha,token);
  if(!["ahead","identical"].includes(String(ancestry.status||"")))return fail("Commit direct-save không còn nằm trên lịch sử main hiện tại",409);
  const currentFiles={},previousFiles={};
  for(const path of audit.paths){
    const current=await gh(base+"/contents/"+encodedPath(path)+"?ref="+encodeURIComponent(mainSha),token);
    if(current.sha!==audit.after_file_shas[path])return fail("Tệp đã thay đổi sau direct-save này. Không tạo rollback tự động để tránh xóa sửa đổi mới.",409);
    currentFiles[path]=current;
    const previous=await gh(base+"/contents/"+encodedPath(path)+"?ref="+encodeURIComponent(parent),token);
    if(previous.encoding!=="base64"||!previous.content)return fail("Không đọc được đầy đủ phiên bản trước direct-save",422);
    if(previous.sha!==audit.before_file_shas[path])return fail("Blob trước direct-save không khớp metadata audit",409);
    previousFiles[path]=previous;
  }
  const currentCommit=await gh(base+"/git/commits/"+mainSha,token);
  if(!validSha(currentCommit.tree?.sha))return fail("Không đọc được Git tree hiện tại",502);
  const blobs=[];
  for(const path of audit.paths){
    const restoredText=td.decode(fromB64(previousFiles[path].content));
    const blob=await gh(base+"/git/blobs",token,{method:"POST",body:JSON.stringify({content:restoredText,encoding:"utf-8"})});
    if(!validSha(blob.sha))return fail("Không tạo được blob rollback",502);
    blobs.push({path,mode:"100644",type:"blob",sha:blob.sha});
  }
  const tree=await gh(base+"/git/trees",token,{method:"POST",body:JSON.stringify({base_tree:currentCommit.tree.sha,tree:blobs})});
  const rollbackCommit=await gh(base+"/git/commits",token,{method:"POST",body:JSON.stringify({
    message:"cms: propose rollback of direct-save "+sourceSha.slice(0,8),tree:tree.sha,parents:[mainSha]
  })});
  if(!validSha(rollbackCommit.sha))return fail("Không tạo được commit rollback",502);
  const safeLogin=String(user.login||"owner").toLowerCase().replace(/[^a-z0-9-]/g,"-").slice(0,24)||"owner";
  const branch="cms/draft/rollback-direct-"+sourceSha.slice(0,8)+"-"+safeLogin+"-"+Date.now();
  await gh(base+"/git/refs",token,{method:"POST",body:JSON.stringify({ref:"refs/heads/"+branch,sha:rollbackCommit.sha})});
  const beforeFileShas=Object.fromEntries(audit.paths.map(path=>[path,currentFiles[path].sha]));
  const afterFileShas=Object.fromEntries(blobs.map(item=>[item.path,item.sha]));
  const rollbackAudit=createCmsMutationAudit({operation:"direct-save-rollback-proposal",actor:user.login,role,baseMainSha:mainSha,
    paths:audit.paths,beforeFileShas,afterFileShas,changedFields:audit.changed_fields,recordId:audit.record_id,
    branch,mutationCommitSha:rollbackCommit.sha});
  const proposal=await gh(base+"/pulls",token,{method:"POST",body:JSON.stringify({
    title,head:branch,base:"main",draft:false,
    body:"## Đề xuất hoàn tác direct-save CMS\n\n- Commit nguồn: `"+sourceSha+"`\n- Các tệp: "+audit.paths.map(x=>"`"+x+"`").join(", ")+"\n- Tất cả tệp đã được kiểm tra vẫn đúng SHA sau direct-save trước khi tạo đề xuất.\n- Khôi phục nội dung từ parent `"+parent+"`.\n\nĐây là PR review; chưa public cho tới khi chủ CMS kiểm tra và merge.\n\n"+formatCmsMutationAudit(rollbackAudit)
  })});
  return json({ok:true,pull_request:{number:proposal.number,url:proposal.html_url},source_direct_save_commit:sourceSha,
    files:audit.paths,rollback_commit:rollbackCommit.sha,audit:{...rollbackAudit,pull_request_number:proposal.number}});
}
export async function onRequest({request,env}){
  try{
    if(request.method!=="POST")return fail("Method not allowed",405);
    if(!sameOrigin(request,{allowMissing:false}))return fail("Origin không hợp lệ",403);
    const user=await readCmsSession(request,String(env.CMS_SESSION_SECRET||""),{requireAccessToken:true});
    if(!user)return fail("Chưa đăng nhập",401);
    const role=await readCurrentCmsRole(user.login,{cacheBustKey:"t",failureMessage:"Không kiểm tra được quyền CMS",includeUserAgent:false});
    const body=await request.json();
    const number=Number(body.pr_number),sourceSha=String(body.direct_save_commit||"").toLowerCase();
    if(Number.isSafeInteger(number)&&number>0){
      if(!cmsCanAny(role,"rollback"))return fail("Chỉ Admin được tạo đề xuất rollback",403);
      return proposePrRollback({user,role,number});
    }
    if(validSha(sourceSha))return proposeDirectSaveRollback({user,role,sourceSha});
    return fail("Cần PR CMS đã merge hoặc commit direct-save hợp lệ",400);
  }catch(e){return json({error:"Không tạo được đề xuất rollback",detail:e?.message||String(e)},e?.status||502)}
}
export const ROLLBACK_TEST={validSha,parseShaPairs,parseDirectSaveAudit};
