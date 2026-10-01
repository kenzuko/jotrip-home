/* Open Phu Quoc multilingual runtime.
 * Vietnamese remains unprefixed. Non-default locales use /<locale>/ once published.
 * The runtime is inert on Vietnamese pages and never exposes unpublished locales. */
(function(root){
"use strict";
if(root.OpenPQI18n)return;
const DEFAULT="vi";
const META='meta[name="openpq-locale"]';
const CATALOG="/data/i18n/catalog.json?v=4";
const state={locale:DEFAULT,catalog:null,ui:null,ready:null};
const q=s=>document.querySelector(s);
function locale(){
  const fromMeta=q(META)?.content;
  if(fromMeta)return fromMeta;
  const lang=(document.documentElement.lang||DEFAULT).toLowerCase();
  if(lang.startsWith("zh-hant"))return"zh-Hant";
  if(lang.startsWith("zh-hans")||lang==="zh-cn")return"zh-Hans";
  return lang.split("-")[0]||DEFAULT;
}
function prefix(code){
  const row=state.catalog?.locales?.find(x=>x.code===code);
  return !row||code===DEFAULT?"":"/"+row.url_code;
}
function routeGroup(path){
  const value=String(path||"/");
  if(value==="/"||value==="/index.html")return"home";
  return /^\/([^/?#]+)/.exec(value)?.[1]||"home";
}
function canServe(code,path){
  if(code===DEFAULT)return true;
  const row=state.catalog?.locales?.find(x=>x.code===code&&x.published);
  if(!row)return false;
  const surfaces=Array.isArray(row.surfaces)?row.surfaces:[];
  return surfaces.includes("*")||surfaces.includes(routeGroup(path));
}
function localize(path,code=state.locale){
  const value=String(path||"/");
  if(!value.startsWith("/")||value.startsWith("//"))return value;
  if(/^\/(?:api|admin|cms|assets|core|data)(?:\/|$)/.test(value))return value;
  if(!canServe(code,value))return value;
  return prefix(code)+(value==="/"?"/":value);
}
function strip(path){
  const value=String(path||"/");
  const rows=state.catalog?.locales||[];
  for(const row of rows){
    if(row.code===DEFAULT)continue;
    const p="/"+row.url_code;
    if(value===p)return"/";
    if(value.startsWith(p+"/"))return value.slice(p.length)||"/";
  }
  return value;
}
async function load(){
  if(state.ready)return state.ready;
  state.ready=(async()=>{
    state.locale=locale();
    try{
      const res=await fetch(CATALOG,{cache:"no-store"});
      if(res.ok)state.catalog=await res.json();
    }catch{}
    return state;
  })();
  return state.ready;
}
async function loadUi(){
  await load();
  if(state.ui)return state.ui;
  const url="/data/i18n/"+encodeURIComponent(state.locale)+"/ui.json";
  const res=await fetch(url,{cache:"default"});
  if(!res.ok)throw Error("UI locale is not published: "+state.locale);
  state.ui=await res.json();
  return state.ui;
}
function t(path,fallback=""){
  const value=String(path||"").split(".").reduce((o,k)=>o?.[k],state.ui);
  return typeof value==="string"?value:fallback;
}
function format(path,vars={},fallback=""){
  return t(path,fallback).replace(/\{([A-Za-z0-9_]+)\}/g,(_,key)=>Object.prototype.hasOwnProperty.call(vars,key)?String(vars[key]):"{"+key+"}");
}
async function apply(rootNode=document){
  await loadUi();
  rootNode.querySelectorAll?.("[data-i18n-key]").forEach(el=>{
    const value=t(el.dataset.i18nKey,"");
    if(value)el.textContent=value;
  });
  rootNode.querySelectorAll?.("[data-i18n-placeholder]").forEach(el=>{
    const value=t(el.dataset.i18nPlaceholder,"");
    if(value)el.setAttribute("placeholder",value);
  });
  rootNode.querySelectorAll?.("[data-i18n-aria-label]").forEach(el=>{
    const value=t(el.dataset.i18nAriaLabel,"");
    if(value)el.setAttribute("aria-label",value);
  });
  document.documentElement.lang=state.catalog?.locales?.find(x=>x.code===state.locale)?.html_lang||state.locale;
  return state.ui;
}
function available(kind,id){
  const rows=state.catalog?.availability?.[kind]||{};
  return Object.entries(rows).filter(([,ids])=>Array.isArray(ids)&&ids.includes(id)).map(([code])=>code);
}
function languageUrl(code,{kind="",id="",pathname=location.pathname,search=location.search}={}){
  const row=state.catalog?.locales?.find(x=>x.code===code&&x.published);
  if(!row)return null;
  const base=strip(pathname);
  if(!canServe(code,base))return null;
  if(kind&&id&&!available(kind,id).includes(code))return null;
  return localize(base,code)+search;
}
root.OpenPQI18n={state,load,loadUi,t,format,apply,locale,localize,strip,available,languageUrl,routeGroup,canServe};
load();
})(window);
