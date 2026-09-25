import { existsSync } from "node:fs";

const required=[
  "worker.js",
  "wrangler.jsonc",
  "dist/index.html",
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

console.log("Cloudflare build validation passed:",required.length,"critical artifacts");
