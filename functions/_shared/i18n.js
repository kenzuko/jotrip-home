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
export function preferredPublishedLocale(header,pathname="/"){
  const raw=String(header||"").trim();
  if(!raw)return DEFAULT_LOCALE;
  const ranked=raw.split(",").map((part,index)=>{
    const bits=part.trim().split(";"),tag=bits.shift()?.trim()||"";
    let q=1;
    for(const bit of bits){
      const m=/^q=([0-9.]+)$/i.exec(bit.trim());
      if(m)q=Math.max(0,Math.min(1,Number(m[1])||0));
    }
    return{tag,q,index};
  }).filter(x=>x.tag&&x.q>0).sort((a,b)=>b.q-a.q||a.index-b.index);
  for(const item of ranked){
    if(item.tag==="*")return DEFAULT_LOCALE;
    const info=localeFromLanguageTag(item.tag);
    if(info&&localeCanServe(info.code,pathname))return info.code;
  }
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
