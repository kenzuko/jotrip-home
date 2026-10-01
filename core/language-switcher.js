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
  style.textContent=".opq-language-auto{display:flex;align-items:center;gap:6px;margin-left:auto;padding:4px;border:1px solid rgba(23,42,48,.14);border-radius:999px;background:rgba(255,255,255,.94);font:600 12px/1.2 system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;white-space:nowrap}.opq-language-auto[hidden]{display:none}.opq-language-auto .opq-language-label{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.opq-language-options{display:flex;gap:2px}.opq-language-options a{display:inline-flex;align-items:center;justify-content:center;min-width:38px;min-height:32px;padding:0 8px;border-radius:999px;color:#233239;text-decoration:none}.opq-language-options a[aria-current=page]{background:#edf4f1;color:#0b5d4b}.opq-language-options a:focus-visible{outline:2px solid currentColor;outline-offset:2px}@media(max-width:760px){.opq-language-auto{order:8;margin-left:auto;margin-right:4px}.opq-language-options a{min-width:40px;min-height:36px;padding:0 8px}}";
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
  const header=document.querySelector(".site-header, header.top, header.knowledge-header, header[role=banner], body > header, header");
  if(!header)return false;
  let host=document.querySelector("[data-openpq-language-switcher-auto]");
  if(!host){
    host=document.createElement("nav");
    host.className="opq-language-auto";
    host.dataset.openpqLanguageSwitcherAuto="";
    host.setAttribute("aria-label","Language");
    host.hidden=true;
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
root.OpenPQLanguageSwitcher={mount,autoMount};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>autoMount().catch(()=>{}),{once:true});
else autoMount().catch(()=>{});
})(window);
