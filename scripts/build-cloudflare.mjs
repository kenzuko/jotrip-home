// OLD_SYSTEM_FINAL_RELEASE_TRIGGER_20261001 - no runtime behavior change; forces full legacy release pipelines.
import { rm, mkdir, cp, copyFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

// Multilingual release gates run before copying the public bundle.
// Cloudflare Pages Git builds run this file alone. Generate the public view
// before regression tests that read data/views/knowledge-public.json, then copy
// only the newly built public view. This also supports stand-alone Pages builds.
execFileSync(process.execPath,["--check","worker.js"],{stdio:"inherit"});
for (const script of ["scripts/test-cms-public-redirect.mjs","scripts/test-i18n-pipeline.mjs","scripts/test-i18n-foundation.mjs","scripts/test-en-full-site.mjs","scripts/test-i18n-content.mjs","scripts/test-i18n-translations.mjs","scripts/build-knowledge-public.mjs","scripts/build-story-locations.mjs","scripts/test-article-maps.mjs","scripts/test-place-feedback.mjs","scripts/weather-context-api.test.mjs","scripts/test-cms-shared-api-routes.mjs","scripts/test-weather-context-client.mjs","scripts/test-weather-human-contract.mjs","scripts/test-nearme-venues.mjs","scripts/test-nearme-runtime.mjs","scripts/test-go-engine.mjs","scripts/test-shared-area-and-schedules.mjs","scripts/test-decision-signals.mjs","scripts/test-cano-history-sync.mjs","scripts/test-cano-operations.mjs","scripts/test-go-geo.mjs","scripts/test-go-manual-ui.mjs","scripts/test-home-library.mjs","scripts/test-article-card-links.mjs","scripts/test-editorial-photo-curation.mjs","scripts/test-home-hero-search.mjs","scripts/test-home-hero-gallery.mjs","scripts/test-homepage-five-chapters.mjs","scripts/validate-public-copy.mjs","scripts/test-editorial-published.mjs","scripts/test-public-source-links.mjs","scripts/test-editorial-photo-audit.mjs","scripts/test-explore-labels.mjs","scripts/build-search-index.mjs","scripts/build-map-coverage.mjs","scripts/build-location-index.mjs","scripts/test-nearme-intake.mjs"]) {
  execFileSync(process.execPath,[script],{stdio:"inherit"});
}

const out="dist";
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});

const rootFiles=[
  "google377c966cd09536e5.html",
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
// Include the canoe page and its verified offline history in CMS Pages builds.
// Live daily state and new history are read from the marine_ops data branch.
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
// Selector is a tiny static enhancement. It is injected into public documents
// after copying so VI keeps the direct Static Assets fast path; no public VI
// route is added to run_worker_first merely to render a language control.
execFileSync(process.execPath,["scripts/inject-static-language-switcher.mjs",out],{stdio:"inherit"});
await rm(`${out}/data/knowledge`,{recursive:true,force:true});
await rm(`${out}/data/knowledge-crawl`,{recursive:true,force:true});
await mkdir(`${out}/cms`,{recursive:true});
if(existsSync("cms/schema.json")) await copyFile("cms/schema.json",`${out}/cms/schema.json`);

execFileSync(process.execPath,["scripts/build-i18n-catalog.mjs"],{stdio:"inherit"});
execFileSync(process.execPath,["scripts/test-i18n-catalog.mjs"],{stdio:"inherit"});
execFileSync(process.execPath,["scripts/build-brand-icons.mjs"],{stdio:"inherit"});
execFileSync(process.execPath,["scripts/test-brand-icons.mjs"],{stdio:"inherit"});
execFileSync(process.execPath,["scripts/test-google-verification.mjs"],{stdio:"inherit"});
execFileSync(process.execPath,["scripts/build-share-card.mjs"],{stdio:"inherit"});
execFileSync(process.execPath,["scripts/test-social-preview.mjs"],{stdio:"inherit"});
execFileSync(process.execPath,["scripts/test-seo-render.mjs"],{stdio:"inherit"});
execFileSync(process.execPath,["scripts/test-seo-ai-discovery.mjs"],{stdio:"inherit"});
execFileSync(process.execPath,["scripts/build-seo-sitemap.mjs"],{stdio:"inherit"});
execFileSync(process.execPath,["scripts/build-ai-discovery.mjs"],{stdio:"inherit"});
execFileSync(process.execPath,["scripts/test-seo-sitemap.mjs"],{stdio:"inherit"});
execFileSync(process.execPath,["scripts/test-traffic-analytics.mjs"],{stdio:"inherit"});
execFileSync(process.execPath,["scripts/build-public-traffic.mjs"],{stdio:"inherit"});
execFileSync(process.execPath,["scripts/test-public-traffic-build.mjs"],{stdio:"inherit"});
await writeFile(`${out}/_headers`,"/\n  Cache-Control: public, max-age=60, must-revalidate\n/go/*\n  Cache-Control: public, max-age=60, must-revalidate\n/assets/share-card-phu-quoc-v3.jpg\n  Cache-Control: public, max-age=86400\n/data/*\n  X-Robots-Tag: noindex\n/admin/*\n  X-Robots-Tag: noindex, nofollow, noarchive\n/api/*\n  X-Robots-Tag: noindex, nofollow, noarchive\n");
await copyFile(new URL("routes.json", import.meta.url),`${out}/_routes.json`);
console.log("Cloudflare Pages output ready in dist/");
