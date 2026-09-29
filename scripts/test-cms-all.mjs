import fs from "node:fs";
import path from "node:path";
import {spawnSync} from "node:child_process";

const list=(dir,predicate)=>fs.readdirSync(dir,{withFileTypes:true})
  .filter(entry=>entry.isFile()&&predicate(entry.name))
  .map(entry=>path.posix.join(dir,entry.name))
  .sort();

const tests=[
  ...list("scripts",name=>/^test-cms-.*\.mjs$/.test(name)&&name!=="test-cms-all.mjs"),
  "scripts/test-food-id-mapping.mjs"
];
const syntax=[
  ...list("admin",name=>name.endsWith(".js")),
  ...list("core",name=>/^cms-.*\.js$/.test(name)),
  ...list("functions/api/cms",name=>name.endsWith(".js")),
  ...list("functions/_shared",name=>/^cms-.*\.js$/.test(name))
];

function run(label,args){
  const result=spawnSync(process.execPath,args,{stdio:"inherit"});
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error(label+" failed with exit "+result.status);
}
for(const file of [...tests,...syntax]){
  if(!fs.existsSync(file))throw new Error("CMS unified test discovery referenced missing file: "+file);
}
console.log("\n[CMS PREP] scripts/build-knowledge-public.mjs");
run("scripts/build-knowledge-public.mjs",["scripts/build-knowledge-public.mjs"]);
for(const file of tests){
  console.log("\n[CMS TEST]",file);
  run(file,[file]);
}
for(const file of syntax){
  console.log("\n[CMS CHECK]",file);
  run(file,["--check",file]);
}
console.log("\nPASS npm run test:cms -",tests.length,"auto-discovered regressions +",syntax.length,"auto-discovered syntax checks");
