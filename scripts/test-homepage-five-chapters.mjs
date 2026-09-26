import assert from "node:assert/strict";
import fs from "node:fs";

const html=fs.readFileSync("index.html","utf8");
const css=fs.readFileSync("styles.css","utf8");
const libraryCss=fs.readFileSync("home-library.css","utf8");
const order=[
  ["energy ticker",'class="energy-ticker"'],
  ["approved hero",'class="hero"'],
  ["six operational tiles",'class="live-strip island-pulse"'],
  ["contextual suggestion",'class="now-card"'],
  ["decision introduction",'data-home-chapter="decide"'],
  ["remaining-day timeline",'id="happening"'],
  ["GO decision entry",'id="go-now"'],
  ["Near Me quick finder",'id="near-me"'],
  ["food now",'id="food-now"'],
  ["editorial introduction",'data-home-chapter="read"'],
  ["latest news",'id="hot-now"'],
  ["practical guides",'id="home-library"'],
  ["island stories",'id="discover"'],
  ["utilities introduction",'data-home-chapter="more"'],
  ["live exchange rates",'id="currency-home"'],
  ["browse more",'id="explore-more"']
];
let previous=-1;
for(const [label,marker] of order){
  const at=html.indexOf(marker);
  assert.ok(at>previous,label+" missing or appears in the wrong chapter");
  previous=at;
}
// Chapters are internal layout groups, not numbered steps for visitors.
const chapterLabels=[...html.matchAll(/class="home-chapter-kicker">([^<]+)<\/span>/g)].map(x=>x[1]);
assert.deepEqual(chapterLabels,["CHỌN VIỆC ĐỂ LÀM","ĐỌC & KHÁM PHÁ","TIỆN ÍCH KHI CẦN"],
  "Visitor-facing chapter labels should be natural words, without misleading 03/04/05 numbering");
// Preserve critical components / working selectors, not merely their headings.
for(const id of [
  "tripClockList","tripClockExtraList","nearQuickSearch","nearCategories",
  "nearQuickMore","nearResults","foodNowGrid","hotNowList",
  "curiosityRail","islandStoryGrid","homeCurrencyGrid","searchResults"
]){
  assert.equal((html.match(new RegExp('id="'+id+'"',"g"))||[]).length,1,
    "Broken or duplicated working module #"+id);
}
assert.equal((html.match(/class="live-item"/g)||[]).length,6,
  "Keep six existing live operational tiles");
assert.equal((html.match(/class="hero-slide(?: is-active)?"/g)||[]).length,4,
  "Keep four approved contextual hero slots");
for(const target of ["happening","go-now","near-me"]){
  assert.ok(html.includes('href="#'+target+'"'),
    "Fast decision shortcut missing "+target);
}
assert.match(css,/#top>.home-chapter-intro\{/);
assert.match(css,/@media\(max-width:760px\)\{/);
assert.match(libraryCss,/Editorial chapter: one softly highlighted weekly cover/);
assert.match(html,/core\/hero-gallery\.js\?/);
assert.match(html,/home-library\.css\?v=20260926-five-chapters-r1/);
console.log("Homepage five-chapter QA PASS: unchanged live/hero modules, decision before editorial, Near Me beside GO, compact mobile shortcuts.");
