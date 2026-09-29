import assert from "node:assert/strict";
import fs from "node:fs";

const html=fs.readFileSync("index.html","utf8");
const css=fs.readFileSync("styles.css","utf8");
const libraryCss=fs.readFileSync("home-library.css","utf8");
const experience=fs.readFileSync("home-experience-v1.js","utf8");
const homeLive=fs.readFileSync("home-live-v3.js","utf8");
const order=[
  ["energy ticker",'class="energy-ticker"'],
  ["approved hero",'class="hero"'],
  ["six operational tiles",'class="live-strip island-pulse"'],
  ["contextual suggestion",'class="now-card"'],
  ["remaining-day timeline",'id="happening"'],
  ["GO decision entry",'id="go-now"'],
  ["Near Me quick finder",'id="near-me"'],
  ["food now",'id="food-now"'],
  ["editorial introduction",'data-home-chapter="read"'],
  ["latest news",'id="hot-now"'],
  ["practical guides",'id="home-library"'],
  ["island stories",'id="discover"'],
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
assert.deepEqual(chapterLabels,["ĐỌC & KHÁM PHÁ"],
  "Only the editorial introduction should remain; decisions and utilities open directly into functional modules");
assert.doesNotMatch(html,/data-home-chapter="(?:decide|more)"/,"Redundant decorative intro cards returned");
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
assert.match(html,/href="#happening"/,"Today remains in the primary navigation");
assert.match(html,/class="nav-go" href="go\/"/,"GO remains in the primary navigation");
assert.match(html,/class="nav-nearme" href="nearme\/"/,"Near Me remains in the primary navigation");
assert.match(css,/#top>\.trip-clock-section\{/,"Today spacing no longer depends on the removed intro");
assert.match(css,/#top>\.home-currency-section\{/,"Currency spacing no longer depends on the removed intro");
assert.match(css,/#top>.home-chapter-intro\{/);
assert.match(css,/@media\(max-width:760px\)\{/);
assert.match(libraryCss,/Editorial chapter: one softly highlighted weekly cover/);
assert.match(html,/core\/hero-gallery\.js\?/);
assert.match(html,/home-library\.css\?v=20260926-five-chapters-r1/);
assert.match(experience,/Hôm nay nhìn chung khá thuận lợi\. Cuối chiều có thể có mây hoặc mưa thoáng qua vài nơi\./,
  "Remaining-day card should use the calmer forecast wording when there is no strong sunset warning");
assert.match(homeLive,/nearSunsetWindow && highConvective/,
  "Satellite convection must only promote the sunset outlook near sunset");
assert.doesNotMatch(homeLive,/else if \(highConvective \|\| elevatedConvective\)/,
  "A standalone morning WATCH satellite signal must not warn for sunset many hours later");
console.log("Homepage QA PASS: chapters preserved and sunset outlook uses forecast-first, lead-time-aware wording.");
