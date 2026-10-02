/* Published-locale switcher.
 * Static-first: Vietnamese pages can mount VI/EN without routing the document
 * through the Worker or loading the full i18n catalog. English pages enhance
 * the same control with OpenPQI18n when the Worker runtime is available. */
(function(root){
"use strict";
if(root.OpenPQLanguageSwitcher)return;
const DEFAULT="vi";
const FALLBACK_LOCALES=[
  {code:"vi",url_code:"vi",html_lang:"vi-VN",native_name:"Tiếng Việt",published:true},
  {code:"en",url_code:"en",html_lang:"en",native_name:"English",published:true}
];
function detectedLocale(){
  const meta=document.querySelector('meta[name="openpq-locale"]')?.content;
  if(meta)return meta;
  if(location.pathname==="/en"||location.pathname.startsWith("/en/"))return"en";
  const lang=(document.documentElement.lang||DEFAULT).toLowerCase();
  return lang.startsWith("en")?"en":DEFAULT;
}
function stripFallback(path){
  const value=String(path||"/");
  if(value==="/en")return"/";
  if(value.startsWith("/en/"))return value.slice(3)||"/";
  return value;
}
function fallbackHref(code){
  const base=stripFallback(location.pathname);
  const path=code===DEFAULT?base:(base==="/"?"/en/":"/en"+base);
  const url=new URL(path,location.origin);
  for(const [key,value] of new URLSearchParams(location.search))if(key!=="lang")url.searchParams.append(key,value);
  url.hash=location.hash;
  return url.pathname+url.search+url.hash;
}
function remember(code){
  try{document.cookie="openpq_lang="+encodeURIComponent(code)+"; Max-Age=31536000; Path=/; SameSite=Lax; Secure"}catch{}
}
function manualHref(href,code){
  try{
    const url=new URL(href,location.origin);
    // /en/* is Worker-routed and can persist the same preference server-side.
    // VI remains static-first; the click handler writes the first-party cookie.
    if(code!==DEFAULT)url.searchParams.set("lang",code);
    else url.searchParams.delete("lang");
    return url.pathname+url.search+url.hash;
  }catch{return href}
}
function ensureStyle(){
  if(document.getElementById("openpq-language-switcher-style"))return;
  const style=document.createElement("style");
  style.id="openpq-language-switcher-style";
  style.textContent=".opq-language-auto{display:flex;align-items:center;gap:6px;margin-left:auto;padding:4px;border:1px solid rgba(23,42,48,.14);border-radius:999px;background:rgba(255,255,255,.96);font:700 12px/1.2 system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;white-space:nowrap;flex:0 0 auto;z-index:30}.opq-language-auto[hidden]{display:none}.opq-language-auto .opq-language-label{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.opq-language-options{display:flex;gap:2px}.opq-language-options a{display:inline-flex;align-items:center;justify-content:center;min-width:38px;min-height:32px;padding:0 8px;border-radius:999px;color:#233239;text-decoration:none}.opq-language-options a[aria-current=page]{background:#edf4f1;color:#0b5d4b}.opq-language-options a:focus-visible{outline:2px solid currentColor;outline-offset:2px}@media(max-width:760px){.opq-language-auto{order:8;margin-left:auto;margin-right:4px}.opq-language-options a{min-width:40px;min-height:36px;padding:0 8px}}";
  document.head.append(style);
}
async function choicesFor(kind,id){
  if(root.OpenPQI18n){
    await root.OpenPQI18n.load();
    const rows=(root.OpenPQI18n.state.catalog?.locales||[]).filter(x=>x.published);
    const available=kind&&id?new Set(root.OpenPQI18n.available(kind,id)):null;
    const basePath=root.OpenPQI18n.strip(location.pathname);
    return rows.filter(x=>(!available||available.has(x.code))&&root.OpenPQI18n.canServe(x.code,basePath));
  }
  // Reviewed EN is released site-wide. Unreviewed locales are deliberately not
  // exposed by this fallback; adding a locale still requires the catalog/runtime.
  return FALLBACK_LOCALES;
}
function hrefFor(row,kind,id){
  if(root.OpenPQI18n){
    const href=root.OpenPQI18n.languageUrl(row.code,{kind,id});
    if(href)return href;
  }
  return fallbackHref(row.code);
}
async function mount(target,{kind="",id=""}={}){
  const host=typeof target==="string"?document.querySelector(target):target;
  if(!host)return false;
  const current=root.OpenPQI18n?root.OpenPQI18n.locale():detectedLocale();
  const serverFallback=host.hasAttribute("data-openpq-language-switcher-server");
  let rows=[];
  try{rows=await choicesFor(kind,id)}catch{}
  if(rows.length<2){
    if(serverFallback){host.hidden=false;ensureStyle();return host.querySelectorAll("a").length>1}
    host.hidden=true;host.replaceChildren();return false
  }
  host.hidden=false;host.replaceChildren();
  const label=document.createElement("span");label.className="opq-language-label";label.textContent="Language";
  const list=document.createElement("div");list.className="opq-language-options";
  for(const row of rows){
    const href=hrefFor(row,kind,id);
    if(!href)continue;
    const a=document.createElement("a");
    a.href=manualHref(href,row.code);
    a.lang=row.html_lang||row.code;
    a.textContent=({vi:"VI",en:"EN"}[row.code]||row.native_name||row.name||row.code);
    a.addEventListener("click",()=>remember(row.code),{passive:true});
    if(row.code===current)a.setAttribute("aria-current","page");
    list.append(a);
  }
  host.append(label,list);return list.children.length>1;
}
async function autoMount(){
  if(!document.body)return false;
  const header=document.querySelector(".site-header, header.top, header.knowledge-header, header[role=banner], body > header, header");
  if(!header)return false;
  let host=document.querySelector("[data-openpq-language-switcher-auto]")||document.querySelector("[data-language-slot]");
  if(!host){
    host=document.createElement("nav");
    host.className="opq-language-auto";
    host.dataset.openpqLanguageSwitcherAuto="";
    host.setAttribute("aria-label","Language");
    host.hidden=true;
  }else{
    host.classList.add("opq-language-auto");
    host.dataset.openpqLanguageSwitcherAuto="";
    if(!host.getAttribute("aria-label"))host.setAttribute("aria-label","Language");
  }
  const menuButton=header.querySelector(".menu-button");
  if(host.parentElement!==header){
    if(menuButton)header.insertBefore(host,menuButton);
    else header.append(host);
  }
  const shown=await mount(host);
  if(shown)ensureStyle();
  return shown;
}
root.OpenPQLanguageSwitcher={mount,autoMount,detectedLocale,fallbackHref};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>autoMount().catch(()=>{}),{once:true});
else autoMount().catch(()=>{});
})(window);
