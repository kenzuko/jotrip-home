import {readCmsSession,readCurrentCmsRole,sameOrigin} from "../../_shared/cms-mutation-core.js";
import {cmsCan,cmsSupports} from "../../_shared/cms-mutation-policy.js";

const MAX_DRAFT_BYTES=1200000;
const CHECKPOINT_MS=5*60*1000;

function json(data,status=200){
  return new Response(JSON.stringify(data),{status,headers:{
    "Content-Type":"application/json; charset=utf-8",
    "Cache-Control":"private, no-store",
    "Vary":"Cookie"
  }});
}

function validScope(value){
  const scope=String(value||"").trim();
  return !scope||/^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,119}$/.test(scope);
}

function draftKey(login,path,scope=""){
  const base=String(login||"").toLowerCase()+"|"+String(path||"");
  const suffix=String(scope||"").trim();
  return suffix?base+"|"+suffix:base;
}

function validSha(value){
  return /^[a-f0-9]{40}$/.test(String(value||"").toLowerCase());
}

function validModuleId(value){
  return /^[a-z0-9][a-z0-9_-]{0,79}$/.test(String(value||""));
}

function validRevisionId(value){
  return /^[a-zA-Z0-9-]{8,80}$/.test(String(value||""));
}

function parseData(raw){
  try{return JSON.parse(String(raw||"null"))}catch{return null}
}

async function draftVersion(row){
  if(!row)return null;
  const input=[row.path,row.base_sha,row.updated_at,row.data_json].map(x=>String(x||"")).join("\n");
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");
}

async function draftView(row,scope=""){
  if(!row)return null;
  return{
    module_id:row.module_id,
    scope:String(scope||""),
    path:row.path,
    base_sha:row.base_sha,
    data:parseData(row.data_json),
    version:await draftVersion(row),
    last_revision_id:row.last_revision_id||null,
    last_checkpoint_at:row.last_checkpoint_at||null,
    created_at:row.created_at,
    updated_at:row.updated_at
  };
}

async function currentDraft(db,key){
  return db.prepare(
    "SELECT draft_key,actor,module_id,path,base_sha,data_json,last_revision_id,last_checkpoint_at,created_at,updated_at FROM cms_drafts WHERE draft_key=?"
  ).bind(key).first();
}

async function draftVersionConflict(current,body){
  if(!Object.prototype.hasOwnProperty.call(body,"expected_version"))return false;
  const expected=body.expected_version==null?null:String(body.expected_version);
  return expected!==await draftVersion(current);
}

async function versionConflictResponse(db,key,current,scope=""){
  return json({
    error:"Bản nháp server đã thay đổi ở nơi khác. Tải lại bản nháp để đối chiếu trước khi ghi tiếp.",
    draft:await draftView(current,scope),
    history:await history(db,key)
  },409);
}

async function history(db,key){
  const result=await db.prepare(
    "SELECT revision_id,base_sha,created_at FROM cms_draft_revisions WHERE draft_key=? ORDER BY created_at DESC LIMIT 20"
  ).bind(key).all();
  return result.results||[];
}

function canCheckpoint(current,baseSha,now,force){
  if(force||!current||current.base_sha!==baseSha||!current.last_checkpoint_at)return true;
  const at=Date.parse(current.last_checkpoint_at);
  return !Number.isFinite(at)||Date.parse(now)-at>=CHECKPOINT_MS;
}

async function saveDraft({db,user,role,body}){
  const path=String(body.path||"");
  const moduleId=String(body.module_id||"");
  const baseSha=String(body.base_sha||"").toLowerCase();
  const scope=String(body.scope||"").trim();
  if(!validScope(scope))return json({error:"Phạm vi bản nháp không hợp lệ"},400);
  if(!cmsSupports(path,"draft"))return json({error:"Không hỗ trợ bản nháp cho tệp này"},400);
  if(!cmsCan(role,path,"draft"))return json({error:"Vai trò hiện tại không được lưu bản nháp module này"},403);
  if(!validModuleId(moduleId)||!validSha(baseSha)||!body.data||typeof body.data!=="object")
    return json({error:"Bản nháp không hợp lệ"},400);

  const dataJson=JSON.stringify(body.data);
  if(dataJson.length>MAX_DRAFT_BYTES)return json({error:"Bản nháp vượt giới hạn CMS"},413);

  const key=draftKey(user.login,path,scope);
  const current=await currentDraft(db,key);
  if(await draftVersionConflict(current,body))return versionConflictResponse(db,key,current,scope);
  if(current&&current.base_sha===baseSha&&current.data_json===dataJson){
    return json({ok:true,unchanged:true,draft:await draftView(current,scope),history:await history(db,key)});
  }

  const now=new Date().toISOString();
  const checkpoint=canCheckpoint(current,baseSha,now,body.checkpoint===true);
  const revisionId=checkpoint?crypto.randomUUID():null;
  const lastRevisionId=revisionId||current?.last_revision_id||null;
  const lastCheckpointAt=checkpoint?now:(current?.last_checkpoint_at||null);
  const statements=[];

  if(checkpoint){
    statements.push(db.prepare(
      "INSERT INTO cms_draft_revisions (revision_id,draft_key,actor,module_id,path,base_sha,data_json,created_at) VALUES (?,?,?,?,?,?,?,?)"
    ).bind(revisionId,key,user.login,moduleId,path,baseSha,dataJson,now));
  }

  statements.push(db.prepare(
    "INSERT INTO cms_drafts (draft_key,actor,module_id,path,base_sha,data_json,last_revision_id,last_checkpoint_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) "+
    "ON CONFLICT(draft_key) DO UPDATE SET actor=excluded.actor,module_id=excluded.module_id,path=excluded.path,base_sha=excluded.base_sha,data_json=excluded.data_json,last_revision_id=excluded.last_revision_id,last_checkpoint_at=excluded.last_checkpoint_at,updated_at=excluded.updated_at"
  ).bind(key,user.login,moduleId,path,baseSha,dataJson,lastRevisionId,lastCheckpointAt,current?.created_at||now,now));

  statements.push(db.prepare(
    "INSERT INTO cms_draft_audit (event_id,draft_key,actor,action,revision_id,base_sha,created_at) VALUES (?,?,?,?,?,?,?)"
  ).bind(crypto.randomUUID(),key,user.login,"save",revisionId,baseSha,now));

  await db.batch(statements);
  const saved=await currentDraft(db,key);
  return json({ok:true,unchanged:false,revision_created:checkpoint,draft:await draftView(saved,scope),history:await history(db,key)});
}

async function restoreDraft({db,user,role,body}){
  const path=String(body.path||"");
  const scope=String(body.scope||"").trim();
  const revisionId=String(body.revision_id||"");
  if(!validScope(scope))return json({error:"Phạm vi bản nháp không hợp lệ"},400);
  if(!cmsSupports(path,"draft"))return json({error:"Không hỗ trợ bản nháp cho tệp này"},400);
  if(!cmsCan(role,path,"draft"))return json({error:"Vai trò hiện tại không được khôi phục bản nháp module này"},403);
  if(!validRevisionId(revisionId))return json({error:"Phiên bản nháp không hợp lệ"},400);

  const key=draftKey(user.login,path,scope);
  const current=await currentDraft(db,key);
  if(await draftVersionConflict(current,body))return versionConflictResponse(db,key,current,scope);
  const source=await db.prepare(
    "SELECT revision_id,draft_key,actor,module_id,path,base_sha,data_json,created_at FROM cms_draft_revisions WHERE draft_key=? AND revision_id=?"
  ).bind(key,revisionId).first();
  if(!source)return json({error:"Không tìm thấy phiên bản nháp"},404);

  const now=new Date().toISOString();
  const newRevisionId=crypto.randomUUID();
  await db.batch([
    db.prepare(
      "INSERT INTO cms_draft_revisions (revision_id,draft_key,actor,module_id,path,base_sha,data_json,created_at) VALUES (?,?,?,?,?,?,?,?)"
    ).bind(newRevisionId,key,user.login,source.module_id,path,source.base_sha,source.data_json,now),
    db.prepare(
      "INSERT INTO cms_drafts (draft_key,actor,module_id,path,base_sha,data_json,last_revision_id,last_checkpoint_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) "+
      "ON CONFLICT(draft_key) DO UPDATE SET actor=excluded.actor,module_id=excluded.module_id,path=excluded.path,base_sha=excluded.base_sha,data_json=excluded.data_json,last_revision_id=excluded.last_revision_id,last_checkpoint_at=excluded.last_checkpoint_at,updated_at=excluded.updated_at"
    ).bind(key,user.login,source.module_id,path,source.base_sha,source.data_json,newRevisionId,now,current?.created_at||now,now),
    db.prepare(
      "INSERT INTO cms_draft_audit (event_id,draft_key,actor,action,revision_id,base_sha,created_at) VALUES (?,?,?,?,?,?,?)"
    ).bind(crypto.randomUUID(),key,user.login,"restore",revisionId,source.base_sha,now)
  ]);
  return json({ok:true,restored_from:revisionId,new_revision_id:newRevisionId,draft:await draftView(await currentDraft(db,key),scope),history:await history(db,key)});
}

async function clearDraft({db,user,role,body}){
  const path=String(body.path||"");
  const scope=String(body.scope||"").trim();
  if(!validScope(scope))return json({error:"Phạm vi bản nháp không hợp lệ"},400);
  if(!cmsSupports(path,"draft"))return json({error:"Không hỗ trợ bản nháp cho tệp này"},400);
  if(!cmsCan(role,path,"draft"))return json({error:"Vai trò hiện tại không được xóa bản nháp module này"},403);
  const key=draftKey(user.login,path,scope);
  const current=await currentDraft(db,key);
  if(await draftVersionConflict(current,body))return versionConflictResponse(db,key,current,scope);
  if(current){
    const now=new Date().toISOString();
    await db.batch([
      db.prepare("DELETE FROM cms_drafts WHERE draft_key=?").bind(key),
      db.prepare(
        "INSERT INTO cms_draft_audit (event_id,draft_key,actor,action,revision_id,base_sha,created_at) VALUES (?,?,?,?,?,?,?)"
      ).bind(crypto.randomUUID(),key,user.login,"clear",current.last_revision_id||null,current.base_sha,now)
    ]);
  }
  return json({ok:true,cleared:Boolean(current),history:await history(db,key)});
}

export async function onRequest({request,env}){
  try{
    if(!["GET","POST"].includes(request.method))return json({error:"Method not allowed"},405);
    const user=await readCmsSession(request,String(env.CMS_SESSION_SECRET||""));
    if(!user)return json({error:"Chưa đăng nhập"},401);
    const role=await readCurrentCmsRole(user.login,{
      cacheBustKey:"draft",failureMessage:"Không kiểm tra được quyền CMS",failureCode:503
    });
    if(!role)return json({error:"Tài khoản CMS đã bị vô hiệu hóa"},401);
    const db=env.CMS_DB;
    if(!db)return json({error:"D1 CMS chưa được gắn vào môi trường này"},503);

    if(request.method==="GET"){
      const url=new URL(request.url);
      const path=String(url.searchParams.get("path")||"");
      const scope=String(url.searchParams.get("scope")||"").trim();
      if(!validScope(scope))return json({error:"Phạm vi bản nháp không hợp lệ"},400);
      if(!cmsSupports(path,"draft"))return json({error:"Không hỗ trợ bản nháp cho tệp này"},400);
      if(!cmsCan(role,path,"draft"))return json({error:"Vai trò hiện tại không được xem bản nháp module này"},403);
      const key=draftKey(user.login,path,scope);
      return json({draft:await draftView(await currentDraft(db,key),scope),history:await history(db,key),storage:"d1"});
    }

    if(!sameOrigin(request,{allowMissing:false}))return json({error:"Origin không hợp lệ"},403);
    const body=await request.json().catch(()=>null);
    if(!body||typeof body!=="object")return json({error:"Yêu cầu bản nháp không hợp lệ"},400);
    const action=String(body.action||"save");
    if(action==="save")return saveDraft({db,user,role,body});
    if(action==="restore")return restoreDraft({db,user,role,body});
    if(action==="clear")return clearDraft({db,user,role,body});
    return json({error:"Thao tác bản nháp không hợp lệ"},400);
  }catch(error){
    return json({error:"Không xử lý được bản nháp CMS",detail:error?.message||String(error)},500);
  }
}

export const DRAFT_TEST={draftKey,validSha,validModuleId,validScope,canCheckpoint,draftVersion,draftView};
