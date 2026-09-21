import { rm, mkdir, cp, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const out="dist";
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});

const rootFiles=[
  "index.html",
  "styles.css",
  "enhancements.css",
  "app.js",
  "home-live.js",
  "home-live-v3.js",
  "home-foundation-v2.js",
  "home-today-v3.js",
  "home-copy.js",
  "home-experience-v1.js",
  "subpage.css",
  "island-clock.js",
  "live-module.css",
  "live-module-v2.css",
  "visual-context.css",
  "visual-context.js",
  ".nojekyll"
];
const dirs=[
  "assets",
  "data",
  "core",
  "airport",
  "guide",
  "stories",
  "utilities",
  "nearme",
  "currency",
  "weather",
  "admin",
  "ferry",
  "transit",
  "bus",
  "cano",
  "places",
  "food",
  "explore",
  "hotels",
  "about"
];

for(const file of rootFiles){
  if(existsSync(file)) await copyFile(file,`${out}/${file}`);
}
for(const dir of dirs){
  if(existsSync(dir)) await cp(dir,`${out}/${dir}`,{recursive:true});
}
await mkdir(`${out}/cms`,{recursive:true});
if(existsSync("cms/schema.json")) await copyFile("cms/schema.json",`${out}/cms/schema.json`);

await copyFile(new URL("routes.json", import.meta.url),`${out}/_routes.json`);
console.log("Cloudflare Pages output ready in dist/");
