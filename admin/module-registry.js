/* Open Phu Quoc CMS - module registry helpers extracted from admin.js.
 * P2.2B: pure schema/role helpers; public preview is always rooted at openphuquoc.com. */
(function(root){
"use strict";

const PUBLIC_ORIGIN="https://openphuquoc.com";
const DASHBOARD=Object.freeze({
  id:"dashboard",label:"Bàn làm việc",
  description:"Nắm tình hình, xử lý đúng việc và kiểm chứng kết quả.",
  write:[],permissions:{publish:[]},preview:null,preview_route:null
});

function roles(module,operation){
  if(!module)return[];
  if(module.permissions&&Array.isArray(module.permissions[operation]))return module.permissions[operation];
  if(operation==="read"&&Array.isArray(module.read))return module.read;
  if(operation==="publish"&&Array.isArray(module.write))return module.write;
  return[];
}
function can(module,role,operation){return roles(module,operation).includes(String(role||""));}
function readable(module,role){return can(module,role,"read");}
function writable(module,role){return can(module,role,"publish");}
function permitted(modules,role){return (modules||[]).filter(module=>readable(module,role));}
function ownerScope(modules,{login,role}={}){
  return (modules||[]).filter(module=>module?.id!=="traffic"||
    (String(login||"")==="kenzuko"&&String(role||"")==="admin"));
}
function resolve(modules,role,id){
  if(id==="dashboard")return {...DASHBOARD};
  return (modules||[]).find(module=>module?.id===id&&readable(module,role))||null;
}
function flags(module){
  const id=module?.id||"";
  return {dashboard:id==="dashboard",analytics:id==="analytics",traffic:id==="traffic"};
}
function previewUrl(module){
  if(!module)return null;
  const route=typeof module.preview_route==="string"?module.preview_route:null;
  if(route){
    if(!route.startsWith("/"))return null;
    return new URL(route,PUBLIC_ORIGIN).href;
  }
  if(typeof module.preview!=="string"||!module.preview)return null;
  return new URL(module.preview,PUBLIC_ORIGIN+"/admin/").href;
}

root.OPQModuleRegistry={PUBLIC_ORIGIN,DASHBOARD,roles,can,readable,writable,permitted,ownerScope,resolve,flags,previewUrl};
})(typeof window!=="undefined"?window:globalThis);
