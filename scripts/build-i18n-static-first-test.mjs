import {cp,mkdir,readdir,readFile,writeFile,rm} from "node:fs/promises";
import {join,relative,sep} from "node:path";

const source=process.argv[2]||"dist";
const out=process.argv[3]||"dist-i18n-test";
const repoRoot=process.cwd();
const localeRegistry=JSON.parse(await readFile(join(repoRoot,"data/i18n/locales.json"),"utf8"));
const published=(localeRegistry.locales||[]).filter(x=>x.published).map(x=>({code:x.code,prefix:x.code===localeRegistry.default_locale?"":"/"+(x.url_code||x.code)}));
if(!published.some(x=>x.code==="vi")||!published.some(x=>x.code==="en"))throw new Error("VI and EN must both be published for this test");
const config={defaultLocale:localeRegistry.default_locale||"vi",locales:published};

await rm(out,{recursive:true,force:true});
await cp(source,out,{recursive:true});

const skipPrefixes=["admin/","cms/"];
const skipFiles=new Set(["google377c966cd09536e5.html"]);
const report=[];
const toPosix=value=>value.split(sep).join("/");
async function htmlFiles(dir){
  const found=[];
  for(const entry of await readdir(dir,{withFileTypes:true})){
    const full=join(dir,entry.name);
    if(entry.isDirectory())found.push(...await htmlFiles(full));
    else if(entry.isFile()&&entry.name.toLowerCase().endsWith(".html"))found.push(full);
  }
  return found;
}
function routeFor(rel){
  if(rel==="index.html")return "/";
  if(rel.endsWith("/index.html"))return "/"+rel.slice(0,-"index.html".length);
  return "/"+rel;
}
function localizedRoute(route,code){
  const row=published.find(x=>x.code===code);
  if(!row)return null;
  return (row.prefix||"")+(route==="/"?"/":route);
}
function selector(route){
  const links=published.map(row=>`<a href="${localizedRoute(route,row.code)}" data-lang="${row.code}" lang="${row.code}">${row.code.toUpperCase()}</a>`).join("");
  return `<nav class="opq-static-language" data-openpq-static-language aria-label="Language">${links}</nav>`;
}
const headAssets=`<link rel="stylesheet" href="/core/locale-router-static.css?v=test1"><script>window.__OPENPQ_LOCALES__=${JSON.stringify(config).replace(/</g,"\\u003c")}</script><script src="/core/locale-router-static.js?v=test1" defer></script>`;

for(const file of await htmlFiles(out)){
  const rel=toPosix(relative(out,file));
  if(skipFiles.has(rel)||skipPrefixes.some(prefix=>rel.startsWith(prefix)))continue;
  let html=await readFile(file,"utf8");
  const route=routeFor(rel);
  const native=/id=["']languageSelect["']/.test(html);
  if(html.includes("data-openpq-static-language"))throw new Error(`Unexpected pre-existing test selector: ${rel}`);
  if(!html.includes("/core/locale-router-static.js")){
    if(!/<\/head>/i.test(html))throw new Error(`Missing </head>: ${rel}`);
    html=html.replace(/<\/head>/i,headAssets+"\n</head>");
  }
  if(!native){
    const body=/<body\b[^>]*>/i.exec(html);
    if(!body)throw new Error(`Missing <body>: ${rel}`);
    html=html.replace(body[0],body[0]+"\n"+selector(route));
  }
  await writeFile(file,html);
  report.push({rel,route,selector:native?"native":"static",published:published.map(x=>x.code),en:localizedRoute(route,"en")});
}
await mkdir(join(out,"_test"),{recursive:true});
await writeFile(join(out,"_test/i18n-static-first-report.json"),JSON.stringify({generated_at:new Date().toISOString(),config,pages:report},null,2));
console.log(`I18N STATIC-FIRST TEST BUNDLE: ${report.length} public HTML pages, ${report.filter(x=>x.selector==="static").length} static selector, ${report.filter(x=>x.selector==="native").length} native selector`);
