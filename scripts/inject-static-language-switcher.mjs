import {readFile,writeFile} from "node:fs/promises";
import {join} from "node:path";

const root=process.argv[2]||"dist";
const VERSION="prototype3";
const SCRIPT=`<script src="/core/language-switcher.js?v=${VERSION}" defer></script>`;
const STYLE=`<link rel="stylesheet" href="/core/language-switcher.css?v=${VERSION}">`;

// Prototype only. Explicit allowlist prevents generic injection into every
// public header. Airport already has a native language selector and is checked
// for duplication but never receives the shared selector in this experiment.
const POLICY={
  "index.html":{mode:"static",vi:"/",en:"/en/",placement:"primary-nav"},
  "weather/index.html":{mode:"static",vi:"/weather/",en:"/en/weather/",placement:"header-tail"},
  "transit/index.html":{mode:"static",vi:"/transit/",en:"/en/transit/",placement:"header-tail"},
  "airport/index.html":{mode:"native",marker:'id="languageSelect"'}
};

const count=(text,needle)=>text.split(needle).length-1;
const selectorMarkup=cfg=>`<div class="opq-language-auto opq-language-static" data-language-slot data-openpq-language-switcher-auto role="navigation" aria-label="Language"><span class="opq-language-label">Language</span><div class="opq-language-options"><a href="${cfg.vi}" lang="vi-VN" data-lang="vi">VI</a><a href="${cfg.en}" lang="en" data-lang="en">EN</a></div></div>`;

function injectMarkup(html,cfg,rel){
  const markup=selectorMarkup(cfg);
  if(cfg.placement==="primary-nav"){
    const re=/(<nav\b[^>]*\bid=["']primary-nav["'][^>]*>[\s\S]*?)(<\/nav>)/i;
    if(!re.test(html))throw new Error(`No primary nav anchor for selector: ${rel}`);
    return html.replace(re,`$1${markup}\n$2`);
  }
  if(cfg.placement==="header-tail"){
    if(!/<\/header>/i.test(html))throw new Error(`No header anchor for selector: ${rel}`);
    return html.replace(/<\/header>/i,markup+"\n</header>");
  }
  throw new Error(`Unknown selector placement for ${rel}`);
}

async function patch(rel,cfg){
  const path=join(root,rel);
  let html=await readFile(path,"utf8");
  if(cfg.mode==="native"){
    if(!html.includes(cfg.marker))throw new Error(`Native language selector missing: ${rel}`);
    if(html.includes("data-language-slot")||html.includes("/core/language-switcher.js"))throw new Error(`Duplicate shared selector on native route: ${rel}`);
    return {rel,mode:"native",changed:false};
  }
  if(count(html,"data-language-slot")>1)throw new Error(`Multiple language slots already present: ${rel}`);
  if(!html.includes("data-language-slot"))html=injectMarkup(html,cfg,rel);
  if(!html.includes("/core/language-switcher.css")){
    if(!/<\/head>/i.test(html))throw new Error(`No </head> for selector stylesheet: ${rel}`);
    html=html.replace(/<\/head>/i,`  ${STYLE}\n</head>`);
  }
  if(!html.includes("/core/language-switcher.js"))html=html.replace(/<\/head>/i,`  ${SCRIPT}\n</head>`);
  if(count(html,"data-language-slot")!==1)throw new Error(`Selector slot count must equal one: ${rel}`);
  await writeFile(path,html);
  return {rel,mode:"static",changed:true};
}

const results=[];
for(const [rel,cfg] of Object.entries(POLICY))results.push(await patch(rel,cfg));
console.log("Prototype language selector policy:",results.map(x=>`${x.rel}:${x.mode}`).join(", "));
