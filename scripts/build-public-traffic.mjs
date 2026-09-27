import {readFile,readdir,writeFile} from "node:fs/promises";
import {join} from "node:path";
const dist=process.env.OPENPQ_DIST||"dist";
const publicDirs=["stories","guide","places","nearme","go","weather","airport","transit","bus","ferry","cano","food","explore","hotels","about","news","utilities","currency"];
let count=0;
async function inject(path){
  const html=await readFile(path,"utf8");
  if(!/<body[\s>]/i.test(html)||!/<\/body>/i.test(html))return;
  if(html.includes("/core/traffic.js"))return;
  const script='<script src="/core/traffic.js?v=20260927" defer></script>';
  const next=html.replace(/<\/body>/i,script+"</body>");
  if(next===html)throw Error("Traffic script insertion failed: "+path);
  await writeFile(path,next,"utf8");count++;
}
await inject(join(dist,"index.html"));
for(const dir of publicDirs){
  async function walk(base){
    let entries=[];
    try{entries=await readdir(base,{withFileTypes:true})}catch(error){if(error.code==="ENOENT")return;throw error}
    for(const entry of entries){
      const path=join(base,entry.name);
      if(entry.isDirectory())await walk(path);
      else if(entry.isFile()&&entry.name.endsWith(".html"))await inject(path);
    }
  }
  await walk(join(dist,dir));
}
if(count<10)throw Error("Traffic injection unexpectedly sparse: "+count);
console.log("Traffic tracker: injected into",count,"public HTML pages, no admin pages");
