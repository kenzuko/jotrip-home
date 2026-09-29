/* Opt-in language switcher. It renders nothing until at least two reviewed locales are published. */
(function(root){
"use strict";
async function mount(target,{kind="",id=""}={}){
  const host=typeof target==="string"?document.querySelector(target):target;
  if(!host||!root.OpenPQI18n)return false;
  await root.OpenPQI18n.load();
  const current=root.OpenPQI18n.locale();
  const rows=(root.OpenPQI18n.state.catalog?.locales||[]).filter(x=>x.published);
  const available=kind&&id?new Set(root.OpenPQI18n.available(kind,id)):null;
  const choices=rows.filter(x=>(!available||available.has(x.code))&&root.OpenPQI18n.canServe(x.code,root.OpenPQI18n.strip(location.pathname)));
  if(choices.length<2){host.hidden=true;host.replaceChildren();return false}
  host.hidden=false;host.replaceChildren();
  const label=document.createElement("span");label.className="opq-language-label";label.textContent="Language";
  const list=document.createElement("div");list.className="opq-language-options";
  for(const row of choices){
    const href=root.OpenPQI18n.languageUrl(row.code,{kind,id});
    if(!href)continue;
    const a=document.createElement("a");a.href=href;a.lang=row.html_lang||row.code;a.textContent=row.native_name||row.name||row.code;
    if(row.code===current)a.setAttribute("aria-current","page");
    list.append(a);
  }
  host.append(label,list);return list.children.length>1;
}
root.OpenPQLanguageSwitcher={mount};
})(window);
