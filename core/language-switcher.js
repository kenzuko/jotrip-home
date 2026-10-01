/* Published-locale switcher.
 * Manual choice is sent through ?lang=<code> so the edge can remember it in
 * a first-party cookie. The control stays hidden until at least two locales
 * can serve the current page. */
(function(root){
"use strict";
function manualHref(href,code){
  try{
    const url=new URL(href,location.origin);
    url.searchParams.set("lang",code);
    return url.pathname+url.search+url.hash;
  }catch{return href}
}
function ensureStyle(){
  if(document.getElementById("openpq-language-switcher-style"))return;
  const style=document.createElement("style");
  style.id="openpq-language-switcher-style";
  style.textContent=".opq-language-auto{position:fixed;right:14px;bottom:16px;z-index:9998;display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid rgba(23,42,48,.14);border-radius:999px;background:rgba(255,255,255,.94);box-shadow:0 8px 28px rgba(23,42,48,.12);backdrop-filter:blur(10px);font:600 12px/1.2 system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif}.opq-language-auto[hidden]{display:none}.opq-language-auto .opq-language-label{color:#647178}.opq-language-options{display:flex;gap:4px}.opq-language-options a{display:inline-flex;align-items:center;min-height:32px;padding:0 9px;border-radius:999px;color:#233239;text-decoration:none}.opq-language-options a[aria-current=page]{background:#edf4f1;color:#0b5d4b}.opq-language-options a:focus-visible{outline:2px solid currentColor;outline-offset:2px}@media(max-width:760px){.opq-language-auto{right:10px;bottom:84px}.opq-language-auto .opq-language-label{display:none}.opq-language-options a{min-height:36px;padding:0 10px}}";
  document.head.append(style);
}
async function mount(target,{kind="",id=""}={}){
  const host=typeof target==="string"?document.querySelector(target):target;
  if(!host||!root.OpenPQI18n)return false;
  await root.OpenPQI18n.load();
  const current=root.OpenPQI18n.locale();
  const rows=(root.OpenPQI18n.state.catalog?.locales||[]).filter(x=>x.published);
  const available=kind&&id?new Set(root.OpenPQI18n.available(kind,id)):null;
  const basePath=root.OpenPQI18n.strip(location.pathname);
  const choices=rows.filter(x=>(!available||available.has(x.code))&&root.OpenPQI18n.canServe(x.code,basePath));
  if(choices.length<2){host.hidden=true;host.replaceChildren();return false}
  host.hidden=false;host.replaceChildren();
  const label=document.createElement("span");label.className="opq-language-label";label.textContent="Language";
  const list=document.createElement("div");list.className="opq-language-options";
  for(const row of choices){
    const href=root.OpenPQI18n.languageUrl(row.code,{kind,id});
    if(!href)continue;
    const a=document.createElement("a");a.href=manualHref(href,row.code);a.lang=row.html_lang||row.code;a.textContent=row.native_name||row.name||row.code;
    if(row.code===current)a.setAttribute("aria-current","page");
    list.append(a);
  }
  host.append(label,list);return list.children.length>1;
}
async function autoMount(){
  if(!document.body||!root.OpenPQI18n)return false;
  let host=document.querySelector("[data-openpq-language-switcher-auto]");
  if(!host){
    host=document.createElement("nav");
    host.className="opq-language-auto";
    host.dataset.openpqLanguageSwitcherAuto="";
    host.setAttribute("aria-label","Language");
    host.hidden=true;
    document.body.append(host);
  }
  const shown=await mount(host);
  if(shown)ensureStyle();
  return shown;
}
root.OpenPQLanguageSwitcher={mount,autoMount};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>autoMount().catch(()=>{}),{once:true});
else autoMount().catch(()=>{});
})(window);
