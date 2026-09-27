import {existsSync,readFileSync,writeFileSync} from "node:fs";
import {join} from "node:path";

const output=process.env.OPENPQ_DIST||"dist";
const base="https://cms.openphuquoc.com";
const records=new Map();
const today=/^\d{4}-\d{2}-\d{2}$/.test(process.env.BUILD_DATE||"")?process.env.BUILD_DATE:null;
const escaped=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
function put(path,lastmod){
  if(!path.startsWith("/")||path.includes("#"))throw Error("Non-canonical sitemap route: "+path);
  const url=new URL(path,base);
  if(url.origin!==base)throw Error("External sitemap URL");
  const date=typeof lastmod==="string"&&/^\d{4}-\d{2}-\d{2}/.test(lastmod)?lastmod.slice(0,10):null;
  const key=url.toString();
  if(!records.has(key)||(!records.get(key)&&date))records.set(key,date);
}
const staticRoutes=["/","/go/","/nearme/","/explore/","/food/","/stories/","/guide/knowledge.html","/guide/","/places/","/news/","/weather/","/airport/","/transit/","/bus/","/cano/","/about/"];
for(const path of staticRoutes){
  const file=path==="/"?"index.html":path.endsWith("/")?path.slice(1)+"index.html":path.slice(1);
  if(existsSync(join(output,file)))put(path);
}
const read=path=>JSON.parse(readFileSync(path,"utf8"));
const guide=read(join(output,"data/views/knowledge-public.json"));
for(const article of guide.objects||[]){
  if(article.topic_id&&article.status!=="draft"&&article.public_ready!==false){
    put("/guide/article.html?id="+encodeURIComponent(article.topic_id),article.updated_at);
  }
}
const stories=read(join(output,"data/content.json"));
for(const article of stories.stories||[]){
  if(article.id&&!["draft","pending","review","scheduled"].includes(article.status)){
    put("/stories/article.html?id="+encodeURIComponent(article.id),article.updated_at);
  }
}
if((guide.objects||[]).length&&!Array.from(records.keys()).some(u=>u.includes("/guide/article.html?id=")))throw Error("Knowledge index empty");
const sitemap='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+
  [...records].map(([url,date])=>"  <url><loc>"+escaped(url)+"</loc>"+(date?"<lastmod>"+date+"</lastmod>":"")+"</url>").join("\n")+
  "\n</urlset>\n";
writeFileSync(join(output,"sitemap.xml"),sitemap,"utf8");
writeFileSync(join(output,"robots.txt"),[
  "User-agent: *",
  "Allow: /",
  "Disallow: /admin/",
  "Disallow: /api/",
  "Disallow: /cms/",
  // Public app JSON must remain crawlable for Googlebot JavaScript rendering.
  // Private sources are excluded from dist by the build.
  "Sitemap: "+base+"/sitemap.xml",
  ""
].join("\n"),"utf8");
console.log("SEO sitemap ready:",records.size,"canonical URLs");
