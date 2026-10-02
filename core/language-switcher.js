/* Open Phu Quoc published-locale switcher prototype.
 * Static-first: build output owns first-paint markup. This runtime only
 * enhances an existing slot/server fallback; it never invents a header or
 * inserts a new selector into arbitrary pages. */
(function(root){
"use strict";
if(root.OpenPQLanguageSwitcher)return;
const DEFAULT="vi";
function detectedLocale(){
  const meta=document.querySelector('meta[name="openpq-locale"]')?.content;
  if(meta)return meta;
  if(location.pathname==="/en"||location.pathname.startsWith("/en/"))return"en";
  return String(document.documentElement.lang||DEFAULT).toLowerCase().startsWith("en")?"en":DEFAULT;
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
  // EN targets are Worker-routed, so the explicit manual choice can still be
  // persisted by the edge without routing the Vietnamese document itself.
  if(code!==DEFAULT)url.searchParams.set("lang",code);
  else url.searchParams.delete("lang");
  url.hash=location.hash;
  return url.pathname+url.search+url.hash;
}
function remember(code){
  try{document.cookie="openpq_lang="+encodeURIComponent(code)+"; Max-Age=31536000; Path=/; SameSite=Lax; Secure"}catch{}
}
function runtimeHref(code){
  if(root.OpenPQI18n){
    try{
      const href=root.OpenPQI18n.languageUrl(code);
      if(href){
        const url=new URL(href,location.origin);
        if(code!==DEFAULT)url.searchParams.set("lang",code);
        else url.searchParams.delete("lang");
        return url.pathname+url.search+url.hash;
      }
    }catch{}
  }
  return fallbackHref(code);
}
function enhance(host){
  if(!host)return false;
  const current=root.OpenPQI18n?.locale?.()||detectedLocale();
  const anchors=[...host.querySelectorAll("a[data-lang],a[lang]")];
  if(anchors.length<2)return false;
  for(const a of anchors){
    const raw=(a.dataset.lang||a.getAttribute("lang")||"").toLowerCase();
    const code=raw.startsWith("en")?"en":raw.startsWith("vi")?"vi":"";
    if(!code)continue;
    a.dataset.lang=code;
    a.href=runtimeHref(code);
    if(code===current)a.setAttribute("aria-current","page");
    else a.removeAttribute("aria-current");
    if(!a.dataset.openpqLanguageBound){
      a.addEventListener("click",()=>remember(code),{passive:true});
      a.dataset.openpqLanguageBound="1";
    }
  }
  host.hidden=false;
  return true;
}
async function autoMount(){
  if(!document.body)return false;
  const host=document.querySelector("[data-language-slot], [data-openpq-language-switcher-server], [data-openpq-language-switcher-auto]");
  if(!host)return false;
  if(root.OpenPQI18n){try{await root.OpenPQI18n.load()}catch{}}
  return enhance(host);
}
root.OpenPQLanguageSwitcher={autoMount,enhance,detectedLocale,fallbackHref};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>autoMount().catch(()=>{}),{once:true});
else autoMount().catch(()=>{});
})(window);
