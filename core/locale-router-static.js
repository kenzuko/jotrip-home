/* TEST-ONLY Open Phu Quoc static-first locale router.
 * No catalog fetch, no Worker dependency, no DOM creation.
 * Build output provides window.__OPENPQ_LOCALES__ from the reviewed locale registry.
 */
(function(root){
"use strict";
if(root.OpenPQLocaleRouter)return;
const config=root.__OPENPQ_LOCALES__||{defaultLocale:"vi",locales:[{code:"vi",prefix:""},{code:"en",prefix:"/en"}]};
const DEFAULT=String(config.defaultLocale||"vi");
const rows=Array.isArray(config.locales)?config.locales:[];
const byCode=new Map(rows.map(row=>[String(row.code),row]));
const ordered=[...rows].filter(row=>row&&row.prefix).sort((a,b)=>String(b.prefix).length-String(a.prefix).length);
function strip(pathname){
  const value=String(pathname||"/");
  for(const row of ordered){
    const prefix=String(row.prefix||"");
    if(value===prefix)return "/";
    if(value.startsWith(prefix+"/"))return value.slice(prefix.length)||"/";
  }
  return value;
}
function current(pathname=location.pathname){
  const value=String(pathname||"/");
  for(const row of ordered){
    const prefix=String(row.prefix||"");
    if(value===prefix||value.startsWith(prefix+"/"))return String(row.code);
  }
  return DEFAULT;
}
function routeFor(code,{pathname=location.pathname,search=location.search,hash=location.hash}={}){
  const row=byCode.get(String(code));
  if(!row)return null;
  const base=strip(pathname);
  const target=(String(row.prefix||"")+(base==="/"?"/":base))||"/";
  const url=new URL(target,"https://openphuquoc.com");
  for(const [key,value] of new URLSearchParams(search||""))if(key!=="lang")url.searchParams.append(key,value);
  url.hash=hash||"";
  return url.pathname+url.search+url.hash;
}
function remember(code){
  if(!byCode.has(String(code)))return false;
  try{document.cookie="openpq_lang="+encodeURIComponent(code)+"; Max-Age=31536000; Path=/; SameSite=Lax; Secure";return true}catch{return false}
}
function enhance(host){
  if(!host)return false;
  const active=current();
  const links=[...host.querySelectorAll("a[data-lang]")];
  if(links.length<2)return false;
  for(const link of links){
    const code=String(link.dataset.lang||"");
    const href=routeFor(code);
    if(!href)continue;
    link.href=href;
    if(code===active)link.setAttribute("aria-current","page");else link.removeAttribute("aria-current");
    if(!link.dataset.localeRouterBound){
      link.addEventListener("click",()=>remember(code),{passive:true});
      link.dataset.localeRouterBound="1";
    }
  }
  return true;
}
function mount(){
  let count=0;
  document.querySelectorAll("[data-openpq-static-language]").forEach(host=>{if(enhance(host))count++});
  return count;
}
root.OpenPQLocaleRouter={config,current,strip,routeFor,remember,enhance,mount};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mount,{once:true});else mount();
})(window);
