import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

const read=path=>readFileSync(path,"utf8");
const scripts=["admin/admin-v2.js","admin/admin.js","admin/quality.js","admin/reviews.js"];
scripts.forEach(path=>new Function(read(path)));
for(const page of ["admin/index.html","admin/quality.html","admin/reviews.html"]){
  const html=read(page);
  assert.match(html,/admin-v2\.css\?v=\d+/,"Every CMS workbench must load shared V2 tokens");
  assert.match(html,/assets\/logo-master\.png/,"Every CMS workbench keeps the approved master logo");
}
const index=read("admin/index.html"),qualityHtml=read("admin/quality.html"),
  reviewsHtml=read("admin/reviews.html");
assert.match(index,/id="quickDialog"/);
assert.match(index,/id="quickOpen"/);
assert.match(index,/class="skip-link"/);
assert.match(index,/admin-v2\.js\?v=\d+/);
assert.match(qualityHtml,/id="workSearch"/);
assert.match(qualityHtml,/data-work-filter="mine"/);
assert.match(qualityHtml,/id="workMore"/);
assert.match(reviewsHtml,/id="reviewSearch"/);
assert.match(reviewsHtml,/data-review-filter="draft"/);
assert.match(reviewsHtml,/id="reviewMore"/);
assert.match(read("functions/api/cms/quality.js"),
  /DO UPDATE SET[^"]*owner=excluded\.owner,due_at=excluded\.due_at/,
  "Quality D1 UPSERT must persist owner and deadline");
assert.match(read("admin/quality.js"),/await load\(true\)/,
  "POST must force reload while the action is in progress");

function extract(src,name){
  const matched=src.match(new RegExp("^function "+name+"\\([^)]*\\)\\s*\\{[\\s\\S]*?^\\}","m"));
  assert.ok(matched,"Missing "+name);
  return matched[0];
}
const root={};
vm.runInNewContext(read("admin/admin-v2.js"),{window:root});
const adminModules=[
  {id:"stories",label:"Bài viết",read:["admin","editor"]},
  {id:"users",label:"Người dùng",read:["admin"]},
  {id:"analytics",label:"Analytics",read:["admin"]},
  {id:"venues",label:"Địa điểm",read:["admin","editor","operator","viewer"]}
];
const editorLinks=root.OPQAdminV2.links(adminModules,"editor");
assert.ok(editorLinks.some(x=>x.id==="stories"));
assert.ok(editorLinks.some(x=>x.id==="reviews"));
assert.ok(editorLinks.some(x=>x.id==="quality"));
assert.ok(!editorLinks.some(x=>x.id==="users"));
assert.ok(!editorLinks.some(x=>x.id==="analytics"));
assert.ok(root.OPQAdminV2.links(adminModules,"admin").some(x=>x.id==="analytics"));
assert.ok(!root.OPQAdminV2.links(adminModules,"viewer").some(x=>x.id==="stories"));
assert.deepEqual(root.OPQAdminV2.links([], "viewer").slice(0,3).map(x=>x.id),
  ["dashboard","quality","reviews"]);
assert.equal(root.OPQAdminV2.links([], "unknown").length,3,
  "Mount must separately deny unknown session roles");

const qualitySrc=read("admin/quality.js");
const qs={
  esc:value=>String(value??"").replace(/[&<>"']/g,c=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c])),
  names:{VENUE_SOURCE_MISSING:"Địa điểm thiếu nguồn",FOOD_ARTICLE_GAP:"Món chưa ghép với bài cũ"},
  severity:{high:"Cần ưu tiên",low:"Theo dõi"},
  today:()=>"2026-09-27"
};
vm.runInNewContext(["entityName","taskHref","datePill","renderQualityTasks"]
  .map(name=>extract(qualitySrc,name)).join("\n"),qs);
const card=qs.renderQualityTasks([{
  rule_id:"VENUE_SOURCE_MISSING",entity_id:"venue&test",field:"source_ref",
  surface:"Địa điểm",severity:"high",status:"in_progress",owner:"editor",
  due_at:"2026-09-26",evidence:"Bãi Sao đang ACTIVE nhưng thiếu <nguồn>",
  next_action:"Bổ sung nguồn đúng"
}],true,"d1");
assert.match(card,/Bãi Sao/);
assert.match(card,/venue%26test/);
assert.match(card,/&lt;nguồn&gt;/);
assert.doesNotMatch(card,/<nguồn>/);
assert.match(card,/Quá hạn 26\/09\/2026/);
assert.match(card,/data-quality-action="due"/);
const noD1=qs.renderQualityTasks([{
  rule_id:"VENUE_SOURCE_MISSING",entity_id:"venue_1",field:"source_ref",
  severity:"high",status:"open",evidence:"Thiếu nguồn"
}],true,"computed-from-main");
assert.doesNotMatch(noD1,/data-quality-action/,"Missing D1 must never show write controls");
const food=qs.renderQualityTasks([{
  rule_id:"FOOD_ARTICLE_GAP",entity_id:"food_bun_ken",field:"legacy_id",
  severity:"low",status:"open",evidence:"Bún kèn có thực thể món"
}],false);
assert.match(food,/module=foods&amp;record=food_bun_ken/);

const reviewSrc=read("admin/reviews.js");
const reviewSandbox={
  reviewState:{filter:"draft",query:"bun quay"},
  normalizeReview:v=>String(v||"").normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"").replace(/[đĐ]/g,"d").toLowerCase().trim()
};
vm.runInNewContext(extract(reviewSrc,"reviewMatches"),reviewSandbox);
assert.equal(reviewSandbox.reviewMatches({draft:true,title:"Bún quậy",number:12}),true);
assert.equal(reviewSandbox.reviewMatches({draft:false,title:"Bún quậy",number:12}),false);
assert.equal(reviewSandbox.reviewMatches({draft:true,title:"Bài khác",number:13}),false);
console.log("PASS CMS V2: shared visual shell, global role navigation, quality filters, XSS, D1 write gate, review search and fixed POST refresh");
