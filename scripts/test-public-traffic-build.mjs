import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
const out=process.env.OPENPQ_DIST||"dist";
const html=readFileSync(out+"/index.html","utf8");
assert.match(html,/\/core\/traffic\.js\?v=20260927/);
assert.equal((html.match(/\/core\/traffic\.js\?v=20260927/g)||[]).length,1);
for(const file of ["go/index.html","guide/article.html","stories/article.html"]){
  const source=readFileSync(out+"/"+file,"utf8");
  assert.ok(source.includes("/core/traffic.js?v=20260927"),file+" must be tracked");
}
const admin=readFileSync(out+"/admin/index.html","utf8");
assert.ok(!admin.includes("/core/traffic.js"),"Admin must never be tracked as public traffic");
assert.ok(admin.includes("traffic-dashboard.js"),"Owner-only CMS dashboard must be deployed");
assert.ok(existsSync(out+"/core/traffic.js"),"Lightweight tracker must be packaged");
assert.ok(!readFileSync(out+"/google377c966cd09536e5.html","utf8").includes("traffic.js"),"Google verification untouched");
console.log("PUBLIC TRAFFIC BUILD PASS: public pages instrumented; admin and verification file excluded");
