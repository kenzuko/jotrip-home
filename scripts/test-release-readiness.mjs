import assert from "node:assert/strict";
import {existsSync,readFileSync,readdirSync,statSync} from "node:fs";
import {dirname,join,resolve} from "node:path";
import {fileURLToPath} from "node:url";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=path=>readFileSync(join(root,path),"utf8");
const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
  if([".git","dist","node_modules"].includes(entry.name))return [];
  const path=join(dir,entry.name);
  return entry.isDirectory()?walk(path):[path];
});

const missing=[];
for(const file of walk(root).filter(path=>path.endsWith(".html"))){
  const html=readFileSync(file,"utf8");
  for(const match of html.matchAll(/(?:href|src)=["']([^"']+)["']/gi)){
    const value=match[1];
    if(/^(?:https?:|\/\/|#|data:|tel:|mailto:|javascript:)/i.test(value))continue;
    const pathname=decodeURIComponent(value.split(/[?#]/)[0]);
    if(!pathname||pathname.includes("{")||pathname.startsWith("/api/"))continue;
    let target=pathname.startsWith("/")?join(root,pathname):resolve(dirname(file),pathname);
    if(existsSync(target)&&statSync(target).isDirectory())target=join(target,"index.html");
    if(!existsSync(target))missing.push(`${file.slice(root.length+1)} -> ${value}`);
  }
}
assert.deepEqual(missing,[],"Public HTML contains missing local files");

const home=read("home-live-v3.js");
assert.match(home,/Sân bay đang hoạt động ổn định/,
  "Airport summary must preserve the island-wide operational state");
assert.match(home,/airportWatch\.count[\s\S]{0,120}cảnh báo đang cần chú ý/,
  "Per-flight warnings must remain visible beside the airport-wide state");

const app=read("app.js");
assert.match(app,/replace\(\/\^Ảnh:\\s\*\/i,""\)/,
  "Hero photo credit must remove an existing prefix");
assert.doesNotMatch(read("weather/index.html"),/weather-analytics\.html/,
  "Private Weather Analytics must not be linked from the public page");
assert.doesNotMatch(read("data/visual-context.json"),/chụp ngày 28\/05\/2016 tại tọa độ 10\.156794, 103\.972519/,
  "Conflicting Bãi Sao camera metadata must not be presented as a destination coordinate");
assert.doesNotMatch(read("transit/app.js"),/age<=30\?"Lịch còn mới":"Thông tin hơi cũ"/,
  "Transit schedules must not be called stale after only 30 minutes");
assert.match(read("index.html"),/core\/public-data\.js\?v=1/,
  "Homepage must load the shared static-data cache before feature modules");
assert.doesNotMatch(read("index.html"),/<script[^>]+src=["'][^"']*cms-(?:inline|draft|direct)/i,
  "Public homepage must not request CMS editor bundles directly");
for(const file of ["stories/article.html","food/article.html","guide/article.html"]){
  assert.doesNotMatch(read(file),/<script[^>]+src=["'][^"']*cms-(?:inline|draft|direct)/i,
    file+" must not request CMS editor bundles on the public origin");
}
assert.match(read("core/public-data.js"),/pending\.has\(key\)/,
  "Shared static data loader must deduplicate concurrent requests");
for(const file of [
  "nearme/nearme.js","stories/story.js","home-today-v3.js","guide/guide.js",
  "guide/knowledge.js","places/detail.js","places/app.js","food/food.js",
  "go/go.js","news/news.js","explore/app.js","hotels/app.js"
]){
  assert.doesNotMatch(read(file),/fetch\([^\n]*\?t=[^\n]*Date\.now/,
    file+" must not bypass browser caching for static editorial/catalog data");
}
assert.match(read("bus/app.js"),/fetch\(NETWORK\+"\?t="\+Date\.now\(\),\{cache:"no-store"\}\)/,
  "Live bus positions must remain uncached");
assert.match(read("home-live-v3.js"),/cache:\s*["'](?:no-cache|no-store)["']/,
  "Homepage operational feeds must explicitly revalidate live data");

console.log("Release readiness regression checks PASS");
