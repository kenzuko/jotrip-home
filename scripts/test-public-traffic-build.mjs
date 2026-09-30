import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";

const out=process.env.OPENPQ_DIST||"dist";
const tracker="/core/traffic.js?v=20260927";
const representative=[
  "index.html",
  "go/index.html",
  "nearme/index.html",
  "explore/index.html",
  "food/index.html",
  "places/index.html",
  "hotels/index.html",
  "utilities/index.html",
  "currency/index.html",
  "weather/index.html",
  "airport/index.html",
  "transit/index.html",
  "bus/index.html",
  "ferry/index.html",
  "cano/index.html",
  "guide/knowledge.html",
  "stories/index.html",
  "news/index.html",
  "about/index.html"
];

for(const file of representative){
  const source=readFileSync(out+"/"+file,"utf8");
  assert.ok(source.includes(tracker),file+" must be tracked");
  assert.equal((source.match(/\/core\/traffic\.js\?v=20260927/g)||[]).length,1,file+" tracker must appear once");
}

for(const file of ["guide/article.html","stories/article.html","places/detail.html"]){
  const source=readFileSync(out+"/"+file,"utf8");
  assert.ok(source.includes(tracker),file+" template must be tracked");
}

const admin=readFileSync(out+"/admin/index.html","utf8");
assert.ok(!admin.includes("/core/traffic.js"),"Admin must never be tracked as public traffic");
assert.ok(admin.includes("traffic-dashboard.js"),"Owner-only CMS dashboard must be deployed");
assert.ok(existsSync(out+"/core/traffic.js"),"Lightweight tracker must be packaged");
assert.ok(!readFileSync(out+"/google377c966cd09536e5.html","utf8").includes("traffic.js"),"Google verification untouched");

console.log("PUBLIC TRAFFIC BUILD PASS: 19 primary public surfaces + article/detail templates instrumented; admin excluded");
