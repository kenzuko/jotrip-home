import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const quality=fs.readFileSync("admin/quality.js","utf8");
const reviews=fs.readFileSync("admin/reviews.js","utf8");
function extract(source,name){
  const match=source.match(new RegExp("^function "+name+"\\([^)]*\\)\\s*\\{[\\s\\S]*?^\\}","m"));
  assert.ok(match,"Missing "+name+"()");
  return match[0];
}
const sandbox={
  esc:value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char])),
  names:{VENUE_COORDINATE_MISSING:"Địa điểm thiếu tọa độ hợp lệ"},
  severity:{high:"Cần ưu tiên",medium:"Cần bổ sung",low:"Theo dõi"},
  when:value=>String(value||"")
};
vm.runInNewContext([
  extract(quality,"renderQualityTasks"),
  extract(quality,"renderReviewTasks"),
  extract(quality,"renderMergedHistory"),
  extract(quality,"countOpenWork")
].join("\n"),sandbox);

const qualityHtml=sandbox.renderQualityTasks([{
  entity_id:"venue/one",
  field:"coordinate_source_ref",
  rule_id:"VENUE_COORDINATE_MISSING",
  severity:"high",
  surface:"Bản đồ",
  evidence:"Thiếu nguồn",
  next_action:"Ghi nguồn"
}],true);
assert.match(qualityHtml,/module=venues&amp;record=venue%2Fone&amp;field=coordinate_source_ref/);
assert.match(qualityHtml,/Mở đúng trường/);
assert.match(qualityHtml,/data-quality-action="refresh"/);
assert.doesNotMatch(qualityHtml,/data-quality-action="resolve"/);
assert.doesNotMatch(qualityHtml,/data-quality-action="mute"/);

const reviewHtml=sandbox.renderReviewTasks([{
  number:42,title:"<img src=x>",draft:false,author:"editor",updated_at:"2026-09-23",
  changed_files:2,additions:5,deletions:1
}]);
assert.match(reviewHtml,/reviews\.html\?pr=42/);
assert.match(reviewHtml,/&lt;img src=x&gt;/);
assert.doesNotMatch(reviewHtml,/<img src=x>/);

const mergedHtml=sandbox.renderMergedHistory([{
  number:41,title:"Venue update",author:"admin",merged_at:"2026-09-22"
}]);
assert.match(mergedHtml,/github\.com\/kenzuko\/jotrip-home\/pull\/41/);
assert.match(mergedHtml,/@admin/);
assert.equal(sandbox.countOpenWork([{},{},{}],[{}]),4);
let reviewClicked=false;
const reviewSandbox={
  URLSearchParams,
  location:{search:"?pr=42"},
  document:{querySelectorAll(selector){
    assert.equal(selector,".field-toggle");
    return [{dataset:{pr:"42"},closest(value){
      assert.equal(value,".card");
      return{scrollIntoView(options){assert.equal(options.block,"center")}};
    },click(){reviewClicked=true}}];
  }}
};
vm.runInNewContext(extract(reviews,"focusRequestedReview"),reviewSandbox);
reviewSandbox.focusRequestedReview();
assert.equal(reviewClicked,true,"Review deep link should open its field diff");
console.log("CMS task center tests passed: quality links, review deep links, safe PR titles and merge history.");
