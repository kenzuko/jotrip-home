/** Prevent CMS website CTAs from pointing to cms.openphuquoc.com. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = p => readFileSync(new URL("../"+p, import.meta.url),"utf8");
const home=read("admin/index.html");
const quality=read("admin/quality.html");
const reviews=read("admin/reviews.html");
const admin=read("admin/admin.js");
assert.equal(home.split('href="https://openphuquoc.com/"').length-1,4);
assert.ok(home.includes("admin.js?v=36"),"Bump JS cache after public-navigation fix");
for(const html of [quality,reviews]) {
  assert.ok(html.includes('class="cms-external" href="https://openphuquoc.com/"'));
}
assert.ok(admin.includes('href="https://openphuquoc.com/guide/knowledge.html"'));
assert.ok(admin.includes('$("#previewBtn").href=new URL(currentModule.preview, "https://openphuquoc.com/admin/").href;'));
for(const target of ["../","../stories/","../guide/","../utilities/","../nearme/","../guide/knowledge.html"]) {
  const resolved=new URL(target,"https://openphuquoc.com/admin/");
  assert.equal(resolved.hostname,"openphuquoc.com",target);
}
assert.ok(!home.includes('href="../"'));
console.log("PASS: canonical public website navigation and CMS module previews");
