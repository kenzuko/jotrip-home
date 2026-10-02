export const DEFAULT_LOCALE="vi";
export const LOCALES=Object.freeze([
  Object.freeze({code:"vi",urlCode:"vi",htmlLang:"vi-VN",published:true,surfaces:Object.freeze(["*"])}),
  Object.freeze({code:"en",urlCode:"en",htmlLang:"en",published:false,surfaces:Object.freeze([])}),
  Object.freeze({code:"ko",urlCode:"ko",htmlLang:"ko",published:false,surfaces:Object.freeze([])}),
  Object.freeze({code:"ru",urlCode:"ru",htmlLang:"ru",published:false,surfaces:Object.freeze([])}),
  Object.freeze({code:"lo",urlCode:"lo",htmlLang:"lo",published:false,surfaces:Object.freeze([])}),
  Object.freeze({code:"zh-Hant",urlCode:"zh-hant",htmlLang:"zh-Hant",published:false,surfaces:Object.freeze([])}),
  Object.freeze({code:"zh-Hans",urlCode:"zh-hans",htmlLang:"zh-Hans",published:false,surfaces:Object.freeze([])}),
  Object.freeze({code:"fr",urlCode:"fr",htmlLang:"fr",published:false,surfaces:Object.freeze([])})
]);
const byCode=new Map(LOCALES.map(x=>[x.code.toLowerCase(),x]));
const byUrl=new Map(LOCALES.map(x=>[x.urlCode.toLowerCase(),x]));
export function localeInfo(value){
  const key=String(value||"").trim().toLowerCase();
  return byCode.get(key)||byUrl.get(key)||null;
}
export function localeFromLanguageTag(value){
  const raw=String(value||"").trim().toLowerCase().replace(/_/g,"-");
  if(!raw||raw==="*")return null;
  if(raw==="zh-hant"||raw.startsWith("zh-hant-")||/^zh-(?:tw|hk|mo)(?:-|$)/.test(raw))return localeInfo("zh-Hant");
  if(raw==="zh-hans"||raw.startsWith("zh-hans-")||/^zh-(?:cn|sg)(?:-|$)/.test(raw)||raw==="zh")return localeInfo("zh-Hans");
  const exact=localeInfo(raw);
  if(exact)return exact;
  return localeInfo(raw.split("-")[0]);
}
export function publishedLocales(){return LOCALES.filter(x=>x.published)}
export function preferredPublishedLocale(){
  // Automatic browser-language negotiation is intentionally disabled.
  // Public traffic stays on Vietnamese until a future owner-approved release.
  return DEFAULT_LOCALE;
}
export function localePrefix(locale){
  const info=localeInfo(locale);
  return !info||info.code===DEFAULT_LOCALE?"":"/"+info.urlCode;
}
export function localizedPath(pathname,locale){
  const path=String(pathname||"/").startsWith("/")?String(pathname||"/"):"/"+String(pathname||"");
  const prefix=localePrefix(locale);
  return prefix+(path==="/"?"/":path);
}
export function splitLocalePath(pathname){
  const path=String(pathname||"/");
  const m=/^\/([^/]+)(\/.*|$)/.exec(path);
  if(!m)return{locale:DEFAULT_LOCALE,localized:false,published:true,pathname:path||"/",prefix:""};
  const info=byUrl.get(String(m[1]||"").toLowerCase());
  if(!info)return{locale:DEFAULT_LOCALE,localized:false,published:true,pathname:path||"/",prefix:""};
  const rest=m[2]||"/";
  if(info.code===DEFAULT_LOCALE)return{locale:DEFAULT_LOCALE,localized:false,defaultPrefixed:true,published:true,pathname:rest.startsWith("/")?rest:"/"+rest,prefix:"/"+info.urlCode,info};
  if(!info.published)return{locale:DEFAULT_LOCALE,localized:false,defaultPrefixed:true,published:false,pathname:rest.startsWith("/")?rest:"/"+rest,prefix:"/"+info.urlCode,info};
  return{locale:info.code,localized:true,defaultPrefixed:false,published:true,pathname:rest.startsWith("/")?rest:"/"+rest,prefix:"/"+info.urlCode,info};
}
export function canonicalFor(pathname,locale=DEFAULT_LOCALE,origin="https://openphuquoc.com"){
  return new URL(localizedPath(pathname,locale),origin).toString();
}
export function hreflang(locale){
  return localeInfo(locale)?.htmlLang||DEFAULT_LOCALE;
}
export function routeGroup(pathname){
  const path=String(pathname||"/");
  if(path==="/"||path==="/index.html")return"home";
  const m=/^\/([^/?#]+)/.exec(path);
  return m?m[1]:"home";
}
export function localeCanServe(locale,pathname){
  const info=localeInfo(locale);
  if(!info||!info.published)return false;
  const surfaces=Array.isArray(info.surfaces)?info.surfaces:[];
  return surfaces.includes("*")||surfaces.includes(routeGroup(pathname));
}
export function alternateSet(pathname,availableLocales=[]){
  const unique=[...new Set(availableLocales.map(x=>localeInfo(x)?.code).filter(Boolean))];
  const rows=unique.map(code=>({locale:code,hreflang:hreflang(code),path:localizedPath(pathname,code)}));
  if(rows.some(x=>x.locale===DEFAULT_LOCALE))rows.push({locale:"x-default",hreflang:"x-default",path:localizedPath(pathname,DEFAULT_LOCALE)});
  return rows;
}
