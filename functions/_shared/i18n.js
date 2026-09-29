export const DEFAULT_LOCALE="vi";
export const LOCALES=Object.freeze([
  Object.freeze({code:"vi",urlCode:"vi",htmlLang:"vi-VN",published:true}),
  Object.freeze({code:"en",urlCode:"en",htmlLang:"en",published:false}),
  Object.freeze({code:"ko",urlCode:"ko",htmlLang:"ko",published:false}),
  Object.freeze({code:"ru",urlCode:"ru",htmlLang:"ru",published:false}),
  Object.freeze({code:"zh-Hant",urlCode:"zh-hant",htmlLang:"zh-Hant",published:false}),
  Object.freeze({code:"zh-Hans",urlCode:"zh-hans",htmlLang:"zh-Hans",published:false})
]);
const byCode=new Map(LOCALES.map(x=>[x.code.toLowerCase(),x]));
const byUrl=new Map(LOCALES.map(x=>[x.urlCode.toLowerCase(),x]));
export function localeInfo(value){
  const key=String(value||"").trim().toLowerCase();
  return byCode.get(key)||byUrl.get(key)||null;
}
export function publishedLocales(){return LOCALES.filter(x=>x.published)}
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
  if(!info||info.code===DEFAULT_LOCALE)return{locale:DEFAULT_LOCALE,localized:false,published:true,pathname:path||"/",prefix:""};
  const rest=m[2]||"/";
  return{locale:info.code,localized:true,published:info.published,pathname:rest.startsWith("/")?rest:"/"+rest,prefix:"/"+info.urlCode,info};
}
export function canonicalFor(pathname,locale=DEFAULT_LOCALE,origin="https://openphuquoc.com"){
  return new URL(localizedPath(pathname,locale),origin).toString();
}
export function hreflang(locale){
  return localeInfo(locale)?.htmlLang||DEFAULT_LOCALE;
}
export function alternateSet(pathname,availableLocales=[]){
  const unique=[...new Set(availableLocales.map(x=>localeInfo(x)?.code).filter(Boolean))];
  const rows=unique.map(code=>({locale:code,hreflang:hreflang(code),path:localizedPath(pathname,code)}));
  if(rows.some(x=>x.locale===DEFAULT_LOCALE))rows.push({locale:"x-default",hreflang:"x-default",path:localizedPath(pathname,DEFAULT_LOCALE)});
  return rows;
}
