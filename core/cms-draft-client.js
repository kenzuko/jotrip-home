(function(root){
"use strict";
const API="/api/cms/drafts";
const versions=new Map(),conflicts=new Set();
const scopeValue=value=>String(value||"").trim();
const refKey=(path,scope="")=>String(path||"")+"\n"+scopeValue(scope);
const same=(a,b)=>{
  try{return JSON.stringify(a)===JSON.stringify(b)}catch{return false}
};
async function request(url,options={}){
  const response=await fetch(url,{
    credentials:"same-origin",cache:"no-store",...options,
    headers:{...(options.body?{"Content-Type":"application/json"}:{}),...(options.headers||{})}
  });
  const body=await response.json().catch(()=>({}));
  if(!response.ok){
    const error=new Error(body.error||body.detail||("HTTP "+response.status));
    error.status=response.status;error.body=body;throw error;
  }
  return body;
}
async function load(path,scope=""){
  const key=refKey(path,scope),scoped=scopeValue(scope);
  try{
    const body=await request(API+"?path="+encodeURIComponent(path)+(scoped?"&scope="+encodeURIComponent(scoped):""));
    versions.set(key,body.draft?.version||null);
    conflicts.delete(key);
    return{ok:true,...body};
  }catch(error){
    return{ok:false,error:error.message,status:error.status||0,detail:error.body||null};
  }
}
async function save({module,path,scope="",baseSha,data,checkpoint=false}){
  const key=refKey(path,scope),scoped=scopeValue(scope);
  if(!versions.has(key))return{ok:false,skipped:true,error:"Chưa đồng bộ trạng thái bản nháp server"};
  if(conflicts.has(key))return{ok:false,status:409,conflict:true,skipped:true,error:"Bản nháp server đang có xung đột; tải lại trước khi ghi tiếp"};
  try{
    const body=await request(API,{method:"POST",body:JSON.stringify({
      action:"save",module_id:module,path,scope:scoped,base_sha:baseSha,data,checkpoint:Boolean(checkpoint),
      expected_version:versions.get(key)
    })});
    versions.set(key,body.draft?.version||versions.get(key)||null);
    return body;
  }catch(error){
    if(error.status===409)conflicts.add(key);
    return{ok:false,error:error.message,status:error.status||0,detail:error.body||null,conflict:error.status===409};
  }
}
async function clear({path,scope=""}){
  const key=refKey(path,scope),scoped=scopeValue(scope);
  if(!versions.has(key))return{ok:false,skipped:true,error:"Chưa đồng bộ trạng thái bản nháp server"};
  if(conflicts.has(key))return{ok:false,status:409,conflict:true,skipped:true,error:"Bản nháp server đang có xung đột; tải lại trước khi xóa"};
  try{
    const body=await request(API,{method:"POST",body:JSON.stringify({
      action:"clear",path,scope:scoped,expected_version:versions.get(key)
    })});
    versions.set(key,null);
    return body;
  }catch(error){
    if(error.status===409)conflicts.add(key);
    return{ok:false,error:error.message,status:error.status||0,detail:error.body||null,conflict:error.status===409};
  }
}
function compare({localDraft,serverDraft,baseSha}){
  const local=localDraft&&typeof localDraft==="object"?localDraft:null;
  const server=serverDraft&&typeof serverDraft==="object"?serverDraft:null;
  const localFresh=Boolean(local&&local.sha===baseSha&&local.data);
  const serverFresh=Boolean(server&&server.base_sha===baseSha&&server.data);
  if(localFresh&&serverFresh)return{
    state:same(local.data,server.data)?"same":"diverged",localFresh,serverFresh
  };
  if(serverFresh)return{state:"server_only",localFresh,serverFresh};
  if(localFresh)return{state:"local_only",localFresh,serverFresh};
  if(local||server)return{state:"stale",localFresh,serverFresh};
  return{state:"empty",localFresh:false,serverFresh:false};
}
function token(path,scope=""){const key=refKey(path,scope);return versions.has(key)?versions.get(key):undefined}
function hasConflict(path,scope=""){return conflicts.has(refKey(path,scope))}
root.OPQDraftStore={load,save,clear,compare,token,hasConflict,refKey};
})(window);
