import assert from "node:assert/strict";
import {existsSync,readFileSync,readdirSync} from "node:fs";
import {join,relative,sep} from "node:path";

const ROOT=process.cwd();
const shell=JSON.parse(readFileSync(join(ROOT,"data/i18n/en/site-shell.json"),"utf8"));
const runtime=readFileSync(join(ROOT,"core/en-full-site.js"),"utf8");
const commonMatch=/const COMMON=(\[[\s\S]*?\]);/.exec(runtime);
assert.ok(commonMatch,"Could not read EN common phrase table");
const common=JSON.parse(commonMatch[1]);
const phrases=[...(shell.phrases||[])].sort((a,b)=>String(b?.[0]||"").length-String(a?.[0]||"").length);

const publicRoots=["about","airport","bus","cano","currency","explore","ferry","food","go","guide","hotels","nearme","news","places","stories","transit","utilities","weather"];
const rootFiles=["index.html","app.js","home-live.js","home-live-v3.js","home-foundation-v2.js","home-nearme-v2.js","home-today-v3.js","home-copy.js","home-experience-v1.js","home-library.js","island-clock.js"];
const skip=/\b(?:admin|cms|localized-pages)\b|(?:\.test|\.spec)\.(?:m?js)$/i;
const skipLocaleSources=new Set([
  "airport/i18n.js","airport/app-copy.js","airport/app.js","airport/airport.js",
  "airport/board-days.js","airport/fids-board.js","airport/flight-status-policy.js",
  "airport/live-config.js","airport/live-source.js","airport/openpq-stability.js"
]);
const skipWeather=/^weather\/(?:spatial-lab|weather-scene)/;

function walk(dir,out=[]){
  if(!existsSync(dir))return out;
  for(const name of readdirSync(dir,{withFileTypes:true})){
    const path=join(dir,name.name);
    if(name.isDirectory())walk(path,out);
    else if(/\.(?:html|js)$/.test(name.name))out.push(path);
  }
  return out;
}
const files=[
  ...rootFiles.filter(x=>existsSync(join(ROOT,x))).map(x=>join(ROOT,x)),
  ...publicRoots.flatMap(x=>walk(join(ROOT,x)))
].filter(path=>{
  const rel=relative(ROOT,path).split(sep).join("/");
  return !skip.test(rel)&&!skipWeather.test(rel)&&!skipLocaleSources.has(rel);
});

function routeKey(rel){
  if(["index.html","app.js","home-live.js","home-live-v3.js","home-foundation-v2.js","home-nearme-v2.js","home-today-v3.js","home-copy.js","home-experience-v1.js","home-library.js","island-clock.js"].includes(rel))return"home";
  if(/^guide\/(?:knowledge|article)/.test(rel))return"knowledge";
  if(/^guide\//.test(rel))return"guide";
  if(/^places\/detail/.test(rel))return"places_detail";
  if(/^cano\/history/.test(rel))return"cano_history";
  if(/^weather\/weather-history/.test(rel))return"weather_history";
  return rel.split("/")[0]||"home";
}
function norm(value){return String(value??"").replace(/\\n/g," ").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/\s+/g," ").trim()}
function applyRules(value){
  let v=value;
  const rules=[
    [/\b(\d+)\s*phút trước\b/gi,"$1 min ago"],
    [/\bhơn\s+(\d+)\s*giờ trước\b/gi,"more than $1 hours ago"],
    [/\b(\d+)\s*giờ trước\b/gi,"$1 hours ago"],
    [/\b(\d+)\s*ngày trước\b/gi,"$1 days ago"],
    [/\b(\d+(?:[.,]\d+)?)\s*km đường chim bay\b/gi,"$1 km straight-line"],
    [/\b(\d+)\s*bài\b/gi,"$1 articles"],
    [/\bTháng\s+(\d+)\b/g,"Month $1"]
  ];
  for(const [re,to] of rules)v=v.replace(re,to);
  return v;
}
function translated(input,key){
  const text=norm(input);
  const exact={...(shell.exact||{}),...(shell.routes?.[key]||{})};
  if(exact[text])return norm(exact[text]);
  let out=text;
  for(const [from,to] of phrases)if(from&&out.includes(from))out=out.split(from).join(to);
  for(const [from,to] of common)if(out.includes(from))out=out.split(from).join(to);
  return applyRules(out);
}
function htmlStrings(source){
  const clean=source.replace(/<script[\s\S]*?<\/script>/gi,"").replace(/<style[\s\S]*?<\/style>/gi,"");
  const values=[...clean.matchAll(/>([^<>]{2,})</g)].map(m=>m[1]);
  for(const m of clean.matchAll(/\b(?:placeholder|aria-label|title|alt|value)=["']([^"']{2,})["']/gi))values.push(m[1]);
  return values;
}
function jsStrings(source){
  const values=[];
  const re=/(["'`])((?:(?!\1).|\\.){2,}?)\1/g;
  for(const m of source.matchAll(re)){
    const s=m[2];
    if(s.length<=1800)values.push(s);
  }
  return values;
}
// These words indicate user-facing Vietnamese prose after the EN transform.
// Proper names such as Bai Truong, Dinh Cau or native street addresses are
// intentionally allowed.
const residue=/(?:^|[\s>·:,(])(?:đang|chưa|không|nếu|hãy|xem|mở|đóng|chọn|tìm|cần|nên|hôm|ngày|giờ|phút|trước|sau|thời|tiết|mưa|gió|sóng|dữ\s*liệu|cập\s*nhật|hoạt\s*động|tình\s*hình|trạng\s*thái|khu\s*vực|địa\s*điểm|giá\s*vé|lịch|quan\s*trắc|dự\s*báo|ước\s*tính|nguồn|thực\s*tế|phù\s*hợp|ghi\s*nhận|tạm\s*dừng|thử\s*lại|vẫn|được|của|với|cho|từ|đến|những|một|đi|này|đó|để)(?:$|[\s<·:,.!?;)])/iu;
const allow=[
  /^https?:/i,/^\/[^\s]*$/,/^[.#\[\]{}()=+*?:;,_A-Za-z0-9\- ]+$/,
  /^Phú Quốc$/i,/^Dương Đông$/i,/^An Thới$/i,/^Gành Dầu$/i,/^Bãi /i,/^Hòn /i,
  /Việt Nam$/i,/An Giang$/i,/ấp\s/i,/tổ\s+\d/i,/đường\s/i,
  /^\[Weather V[23]\]/,/console|warn|error/i
];
const problems=[];
for(const file of files){
  const rel=relative(ROOT,file).split(sep).join("/");
  const key=routeKey(rel);
  const source=readFileSync(file,"utf8");
  const strings=rel.endsWith(".html")?htmlStrings(source):jsStrings(source);
  for(const raw of strings){
    const before=norm(raw);
    if(before.length<2||allow.some(re=>re.test(before)))continue;
    const after=translated(before,key);
    if(residue.test(after))problems.push({file:rel,before,after});
  }
}
const unique=[];const seen=new Set();
for(const p of problems){
  const k=p.file+"\u0000"+p.before;
  if(!seen.has(k)){seen.add(k);unique.push(p)}
}
if(unique.length){
  console.error("EN full-site residue audit FAILED:",unique.length,"untranslated UI/prose strings");
  for(const p of unique.slice(0,250)){
    console.error("\n["+p.file+"]");
    console.error("VI:",p.before);
    console.error("EN:",p.after);
  }
  if(unique.length>250)console.error("\n... plus",unique.length-250,"more");
  process.exit(1);
}
console.log("PASS EN full-site residue audit:",files.length,"public HTML/JS files; 0 Vietnamese UI/prose residues");
