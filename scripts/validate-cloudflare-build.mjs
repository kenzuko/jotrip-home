import { existsSync, readFileSync } from "node:fs";

const required=[
  "worker.js",
  "wrangler.jsonc",
  "dist/index.html",
  "dist/home-library.css",
  "dist/home-library.js",
  "dist/data/views/knowledge-home.json",
  "dist/styles.css",
  "dist/jotrip-service-card.css",
  "dist/news/index.html",
  "dist/news/news.css",
  "dist/news/news.js",
  "dist/nearme/index.html",
  "dist/nearme/nearme.css",
  "dist/nearme/nearme.js",
  "dist/home-nearme-v2.js",
  "dist/data/home-support.json",
  "dist/data/views/search-index.json",
  "dist/data/views/map-coverage.json",
  "dist/stories/article.html",
  "dist/places/detail.html"
];

const missing=required.filter(path=>!existsSync(path));
if(missing.length){
  console.error("Cloudflare build validation failed. Missing:");
  missing.forEach(path=>console.error(" - "+path));
  process.exit(1);
}

const feed=JSON.parse(readFileSync("dist/data/views/knowledge-home.json","utf8"));
const publicView=JSON.parse(readFileSync("dist/data/views/knowledge-public.json","utf8"));
const ids=new Set(feed.objects.map(o=>o.topic_id));
if(feed.count!==publicView.count||feed.count!==feed.objects.length||ids.size!==feed.count
  ||feed.objects.some(o=>!publicView.objects.some(p=>p.topic_id===o.topic_id))
  ||feed.objects.some(o=>!/^\/guide\/article\.html\?id=knowledge_/.test(o.route))){
  console.error("Cloudflare build validation failed: homepage knowledge feed must match public-only knowledge view");
  process.exit(1);
}
console.log("Cloudflare build validation passed:",required.length,"critical artifacts,",
  feed.count,"public-only homepage teasers");
