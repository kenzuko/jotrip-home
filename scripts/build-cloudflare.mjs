import { rm, mkdir, cp, copyFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

// Cloudflare Pages Git builds run this file alone. Generate the public view
// before copying data so CMS never serves a stale or empty knowledge library.
for (const script of ["scripts/test-go-engine.mjs","scripts/test-shared-area-and-schedules.mjs","scripts/test-decision-signals.mjs","scripts/test-go-geo.mjs","scripts/test-go-manual-ui.mjs","scripts/test-home-library.mjs","scripts/test-editorial-photo-curation.mjs","scripts/test-home-hero-search.mjs","scripts/test-home-hero-gallery.mjs","scripts/test-homepage-five-chapters.mjs","scripts/validate-public-copy.mjs","scripts/test-editorial-photo-audit.mjs","scripts/test-explore-labels.mjs","scripts/build-knowledge-public.mjs","scripts/build-search-index.mjs"]) {
  execFileSync(process.execPath,[script],{stdio:"inherit"});
}

const out="dist";
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});

const rootFiles=[
  "index.html",
  "styles.css",
  "ecosystem-shell.css",
  "enhancements.css",
  "app.js",
  "home-live.js",
  "home-live-v3.js",
  "home-foundation-v2.js",
  "home-nearme-v2.js",
  "home-today-v3.js",
  "home-copy.js",
  "home-experience-v1.js",
  "home-library.js",
  "home-library.css",
  "subpage.css",
  "island-clock.js",
  "live-module.css",
  "live-module-v2.css",
  "visual-context.css",
  "visual-context.js",
  "map-basemap.js",
  "jotrip-service-card.css",
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
  "about",
  "news",
  "go"
];

for(const file of rootFiles){
  if(existsSync(file)) await copyFile(file,`${out}/${file}`);
}
for(const dir of dirs){
  if(existsSync(dir)) await cp(dir,`${out}/${dir}`,{recursive:true});
}
await rm(`${out}/data/knowledge`,{recursive:true,force:true});
await rm(`${out}/data/knowledge-crawl`,{recursive:true,force:true});
await mkdir(`${out}/cms`,{recursive:true});
if(existsSync("cms/schema.json")) await copyFile("cms/schema.json",`${out}/cms/schema.json`);

execFileSync(process.execPath,["scripts/build-share-card.mjs"],{stdio:"inherit"});
execFileSync(process.execPath,["scripts/test-social-preview.mjs"],{stdio:"inherit"});
await writeFile(`${out}/_headers`,"/\n  Cache-Control: public, max-age=60, must-revalidate\n/go/*\n  Cache-Control: public, max-age=60, must-revalidate\n/assets/share-card-phu-quoc-v3.jpg\n  Cache-Control: public, max-age=86400\n");
await copyFile(new URL("routes.json", import.meta.url),`${out}/_routes.json`);
console.log("Cloudflare Pages output ready in dist/");
