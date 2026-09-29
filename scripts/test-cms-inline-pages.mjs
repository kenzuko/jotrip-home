import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
const code=readFileSync("core/cms-inline-pages.js","utf8");
const win={addEventListener(){}};
const doc={readyState:"loading",addEventListener(){}};
const location={pathname:"/guide/article.html",hostname:"cms.openphuquoc.com",search:"?id=knowledge_001_dinh-cau"};
vm.runInNewContext(code,{window:win,document:doc,location,URLSearchParams});
const t=win.OPQInlinePagesTest;
const record={title:"Dinh Cậu",editorial:{short_summary:"Lời mở",before_you_go:["Mang mũ"]}};
assert.equal(t.pathValue(record,"editorial.short_summary"),"Lời mở");
t.patch(record,"editorial.short_summary","Đã sửa");
assert.equal(record.editorial.short_summary,"Đã sửa");
t.patch(record,"editorial.before_you_go.0","Xem điều kiện");
assert.equal(record.editorial.before_you_go[0],"Xem điều kiện");
const home=readFileSync("home-copy.js","utf8"),guide=readFileSync("guide/knowledge.js","utf8");
for(const x of ["hero.kicker","hero.title","hero.lead","sections."])
  assert.ok(home.includes(x),"Unmapped home copy: "+x);
for(const x of ["editorial.short_summary","editorial.practical","editorial.before_you_go.","editorial.expectation_vs_reality"])
  assert.ok(guide.includes(x),"Unmapped guide editorial: "+x);
const loader=readFileSync("core/cms-editor-loader.js","utf8");
for(const page of ["index.html","guide/article.html"]){
  const html=readFileSync(page,"utf8");
  assert.match(html,/cms-editor-loader\.js\?v=1/,page+" must request the CMS editor loader");
  assert.match(html,/cmsEditor="page"/,page+" must select the page editor");
}
assert.match(loader,/cms-inline-pages\.js\?v=1/,
  "CMS loader must include the page editor bundle");
assert.match(code,/id="cmsPagePublish"[^>]*>Xuất bản<\/button>/);
assert.match(code,/Nháp lưu trên máy • Xuất bản mới ghi GitHub 1 lần/);
assert.doesNotMatch(code,/Lưu lên website/);
console.log("PASS CMS inline pages: knowledge and homepage text mappings and safe draft utility");
