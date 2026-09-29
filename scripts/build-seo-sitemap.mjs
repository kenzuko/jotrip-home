import {existsSync,readFileSync,writeFileSync} from "node:fs";
import {join} from "node:path";

const output=process.env.OPENPQ_DIST||"dist";
const base="https://openphuquoc.com";
const read=path=>JSON.parse(readFileSync(path,"utf8"));
const catalog=read(join(output,"data/i18n/catalog.json"));
const defaultLocale=catalog.default_locale||"vi";
const published=(catalog.locales||[]).filter(x=>x.published);
const records=new Map();
const escaped=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const group=pathname=>pathname==="/"?"home":(/^\/([^/?#]+)/.exec(pathname)?.[1]||"home");
const canServe=(locale,pathname)=>Array.isArray(locale?.surfaces)&&(locale.surfaces.includes("*")||locale.surfaces.includes(group(pathname)));
const localePath=(pathname,locale)=>locale.code===defaultLocale?pathname:"/"+locale.url_code+(pathname==="/"?"/":pathname);
const language=locale=>locale.html_lang||locale.code;
function alternatesFor(pathname,locales){
  if(locales.length<2)return[];
  const rows=locales.map(locale=>({hreflang:language(locale),href:new URL(localePath(pathname,locale),base).toString()}));
  const fallback=locales.find(x=>x.code===defaultLocale);
  if(fallback)rows.push({hreflang:"x-default",href:new URL(localePath(pathname,fallback),base).toString()});
  return rows;
}
function put(path,lastmod,alternates=[]){
  if(!path.startsWith("/")||path.includes("#"))throw Error("Non-canonical sitemap route: "+path);
  const url=new URL(path,base);
  if(url.origin!==base)throw Error("External sitemap URL");
  const date=typeof lastmod==="string"&&/^\d{4}-\d{2}-\d{2}/.test(lastmod)?lastmod.slice(0,10):null;
  const key=url.toString();
  const prior=records.get(key);
  if(!prior||(!prior.date&&date))records.set(key,{date,alternates});
}
function addLocalized(path,lastmod,locales){
  const rows=locales.filter(locale=>canServe(locale,path));
  const alternates=alternatesFor(path,rows);
  for(const locale of rows)put(localePath(path,locale),lastmod,alternates);
}
const staticRoutes=["/","/go/","/nearme/","/explore/","/food/","/stories/","/guide/knowledge.html","/guide/","/places/","/news/","/weather/","/airport/","/transit/","/bus/","/cano/","/about/"];
for(const path of staticRoutes){
  const file=path==="/"?"index.html":path.endsWith("/")?path.slice(1)+"index.html":path.slice(1);
  if(existsSync(join(output,file)))addLocalized(path,null,published);
}
const guide=read(join(output,"data/views/knowledge-public.json"));
for(const article of guide.objects||[]){
  if(article.topic_id&&article.status!=="draft"&&article.public_ready!==false){
    const path="/guide/article.html?id="+encodeURIComponent(article.topic_id);
    const locales=published.filter(locale=>canServe(locale,path)&&
      (catalog.availability?.knowledge?.[locale.code]||[]).includes(article.topic_id));
    addLocalized(path,article.updated_at,locales);
  }
}
const stories=read(join(output,"data/content.json"));
for(const article of stories.stories||[]){
  if(article.id&&!["draft","pending","review","scheduled"].includes(article.status)){
    const path="/stories/article.html?id="+encodeURIComponent(article.id);
    const locales=published.filter(locale=>canServe(locale,path)&&
      (catalog.availability?.stories?.[locale.code]||[]).includes(article.id));
    addLocalized(path,article.updated_at,locales);
  }
}
if((guide.objects||[]).length&&!Array.from(records.keys()).some(u=>u.includes("/guide/article.html?id=")))throw Error("Knowledge index empty");
const hasAlternates=[...records.values()].some(x=>x.alternates?.length);
const namespace=hasAlternates?' xmlns:xhtml="http://www.w3.org/1999/xhtml"':"";
const sitemap='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'+namespace+'>\n'+
  [...records].map(([url,row])=>"  <url><loc>"+escaped(url)+"</loc>"+(row.date?"<lastmod>"+row.date+"</lastmod>":"")+
    (row.alternates||[]).map(x=>'<xhtml:link rel="alternate" hreflang="'+escaped(x.hreflang)+'" href="'+escaped(x.href)+'"/>').join("")+"</url>").join("\n")+
  "\n</urlset>\n";
writeFileSync(join(output,"sitemap.xml"),sitemap,"utf8");
writeFileSync(join(output,"robots.txt"),[
  "User-agent: *",
  "Allow: /",
  "Disallow: /admin/",
  "Disallow: /api/",
  "Disallow: /cms/",
  "Sitemap: "+base+"/sitemap.xml",
  ""
].join("\n"),"utf8");
console.log("SEO sitemap ready:",records.size,"canonical URLs;",published.length,"published locale(s)");
