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
assert.doesNotMatch(home,/airportWatch\.count[\s\S]{0,240}Hoạt động ổn định[\s\S]{0,120}cảnh báo đang cần chú ý/,
  "Airport summary must not call a watched state stable");
assert.match(home,/airportWatch\.count \? "Có chuyến cần chú ý"/,
  "Airport watch state must be visible in the primary summary");

const app=read("app.js");
assert.match(app,/replace\(\/\^Ảnh:\\s\*\/i,""\)/,
  "Hero photo credit must remove an existing prefix");
assert.doesNotMatch(read("weather/index.html"),/weather-analytics\.html/,
  "Private Weather Analytics must not be linked from the public page");
assert.doesNotMatch(read("data/visual-context.json"),/chụp ngày 28\/05\/2016 tại tọa độ 10\.156794, 103\.972519/,
  "Conflicting Bãi Sao camera metadata must not be presented as a destination coordinate");
assert.doesNotMatch(read("transit/app.js"),/age<=30\?"Lịch còn mới":"Thông tin hơi cũ"/,
  "Transit schedules must not be called stale after only 30 minutes");

console.log("Release readiness regression checks PASS");
