import {readFile,writeFile,readdir} from "node:fs/promises";
import {join,relative,sep} from "node:path";

const root=process.argv[2]||"dist";
const TAG='<script src="/core/language-switcher.js?v=5" defer></script>';
const SKIP=/^(?:admin|cms)(?:\/|$)/;
let scanned=0,changed=0;

async function walk(dir){
  for(const entry of await readdir(dir,{withFileTypes:true})){
    const path=join(dir,entry.name);
    if(entry.isDirectory())await walk(path);
    else if(entry.name.endsWith(".html"))await patch(path);
  }
}
async function patch(path){
  const rel=relative(root,path).split(sep).join("/");
  if(SKIP.test(rel))return;
  scanned++;
  let html=await readFile(path,"utf8");
  if(html.includes("/core/language-switcher.js"))return;
  if(!/<\/head>/i.test(html))throw new Error("Public HTML has no </head>: "+rel);
  html=html.replace(/<\/head>/i,"  "+TAG+"\n</head>");
  await writeFile(path,html);
  changed++;
}

await walk(root);
if(!scanned)throw new Error("No public HTML found under "+root);
console.log(`Static language selector: ${changed}/${scanned} public HTML files injected`);
