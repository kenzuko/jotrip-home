/* Open Phu Quoc multilingual runtime.
 * Vietnamese remains unprefixed. Non-default locales use /<locale>/ once published.
 * The runtime is inert on Vietnamese pages and never exposes unpublished locales. */
(function(root){
"use strict";
const DEFAULT="vi";
const META='meta[name="openpq-locale"]';
const CATALOG="/data/i18n/catalog.json";
const state={locale:DEFAULT,catalog:null};
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
function localize(path,code=state.locale){
  const value=String(path||"/");
  if(!value.startsWith("/")||value.startsWith("//"))return value;
  if(/^\/(?:api|admin|cms|assets|core|data)(?:\/|$)/.test(value))return value;
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
  state.locale=locale();
  try{
    const res=await fetch(CATALOG,{cache:"default"});
    if(res.ok)state.catalog=await res.json();
  }catch{}
  return state;
}
function available(kind,id){
  const rows=state.catalog?.availability?.[kind]||{};
  return Object.entries(rows).filter(([,ids])=>Array.isArray(ids)&&ids.includes(id)).map(([code])=>code);
}
function languageUrl(code,{kind="",id="",pathname=location.pathname,search=location.search}={}){
  const row=state.catalog?.locales?.find(x=>x.code===code&&x.published);
  if(!row)return null;
  if(kind&&id&&!available(kind,id).includes(code))return null;
  const base=strip(pathname);
  return localize(base,code)+search;
}
root.OpenPQI18n={state,load,locale,localize,strip,available,languageUrl};
load();
})(window);
