import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
const code=readFileSync("core/cms-inline-food.js","utf8");
const mock={addEventListener(){}},document={readyState:"loading",addEventListener(){}};
vm.runInNewContext(code,{window:mock,document});
const t=mock.OPQInlineFoodTest;
assert.equal(t.roleOK("admin"),true);
assert.equal(t.roleOK("editor"),true);
assert.equal(t.roleOK("viewer"),false);
assert.equal(t.roleOK("operator"),false);
const record={name:"Bún quậy",intro:"Món ngon",tips:["Hỏi giá"],ingredients:["Bún"],ask_staff:["Có tôm không?"]};
for(const key of ["name","intro","tips.0","ask_staff.0","ingredients.0"])
  assert.equal(t.goodField(record,key),true,key);
for(const key of ["__proto__","constructor","tips.-1","tips.1","ingredients.999","allergen_flags.0"])
  assert.equal(t.goodField(record,key),false,key);
assert.equal(t.write(record,"tips.0","Nhớ kiểm tra"),true);
assert.equal(t.read(record,"tips.0"),"Nhớ kiểm tra");
assert.equal(t.write(record,"constructor","bad"),false);
assert.notEqual(t.draftKey("admin","bun-quay","aaa"),t.draftKey("admin","bun-quay","bbb"));
const html=readFileSync("food/article.html","utf8");
const food=readFileSync("food/food.js","utf8");
const css=readFileSync("food/food.css","utf8");
assert.match(html,/cms-inline-food\.js\?v=1/);
for(const key of ['name','intro','tips.','ingredients.','ask_staff.','allergy_note','how_to_eat'])
  assert.ok(food.includes('data-food-path=\\"'+key)||food.includes('data-food-path="'+key),"Missing "+key);
assert.match(css,/\.food-article section\.food-safety\{[\s\S]*?padding:clamp\(/);
const policy=readFileSync("functions/_shared/cms-mutation-policy.js","utf8");
assert.match(policy,/"data\/i18n\/vi\/food\.json"/,"Food path must stay in the centralized CMS mutation policy");
for(const p of ["content.js","edit-state.js","publish.js"])
  assert.match(readFileSync("functions/api/cms/"+p,"utf8"),/cms-mutation-policy\.js/,""+p+" must use centralized CMS path policy");
assert.match(readFileSync("admin/index.html","utf8"),/Duyệt website &amp; sửa bài|Duyệt website & sửa bài/);
const publish=readFileSync("functions/api/cms/publish.js","utf8");
assert.match(publish,/mirrorData\.dishes=body\.content\.dishes/);
assert.match(publish,/pathsToCheck\.has\(file\.filename\)/);
assert.match(readFileSync("functions/api/cms/edit-state.js","utf8"),/companion_sha/);
assert.match(code,/id="foodInlinePublish"[^>]*hidden>Xuất bản/);
assert.match(code,/state\.role==="admin"\)\$\("#foodInlinePublish"\)\.disabled=false/);
assert.doesNotMatch(code,/Lưu thẳng \(Admin\)/);
console.log("PASS CMS food inline: role gate, text-field whitelist, article targets, safe PR API allowlist and card padding");
