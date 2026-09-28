import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
const code=readFileSync("core/cms-inline-static.js","utf8");
const win={addEventListener(){}},doc={readyState:"loading",addEventListener(){},querySelectorAll(){return[]}};
const location={hostname:"cms.openphuquoc.com"};
vm.runInNewContext(code,{window:win,document:doc,location,fetch(){throw Error("no fetch")},URLSearchParams,JSON,String,Object,Array,Date,encodeURIComponent,localStorage:{getItem(){return null}},crypto:{}});
const t=win.OPQStaticCopyTest;
const d=JSON.parse(readFileSync("data/home-copy.json","utf8"));
assert.ok(t.safePaths(d).includes("footer.lead"));
assert.ok(t.safePaths(d).includes("site.about.heroLead"));
assert.ok(t.safePaths(d).includes("site.utilities.footer"));
assert.ok(t.safePaths(d).length>50);
const copy=JSON.parse(JSON.stringify(d));t.set(copy,"site.about.heroLead","Đã sửa tại chỗ");
assert.equal(t.get(copy,"site.about.heroLead"),"Đã sửa tại chỗ");
for(const page of ["about/index.html","food/index.html","stories/index.html","guide/index.html","places/index.html","utilities/index.html","explore/index.html","hotels/index.html","nearme/index.html","go/index.html"]){
 const html=readFileSync(page,"utf8");
 assert.match(html,/data-cms-static-field=/,page+" missing safe copy fields");
 assert.match(html,/cms-inline-static\.js\?v=1/,page+" missing inline static editor");
 assert.match(html,/site-copy\.js\?v=1/,page+" missing public copy runtime");
}
const direct=readFileSync("functions/api/cms/direct-save.js","utf8");
assert.ok(direct.includes('if(/^site(?:\\.[A-Za-z0-9_-]+){2,6}$/.test(field))'));
assert.match(direct,/changeLimit=path==="data\/home-copy\.json"\?160:60/);
assert.match(readFileSync("home-copy.js","utf8"),/footer\.lead/);
assert.match(readFileSync("index.html","utf8"),/data-cms-field="footer\.lead"/);
console.log("PASS CMS static copy: safe mapped text across editorial pages, shared drafts and one-publish source");