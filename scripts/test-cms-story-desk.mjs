import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
const code=readFileSync("admin/story-desk.js","utf8");
const root={};
vm.runInNewContext(code,{window:root});
const d=root.OPQStoryDesk;
const list=[
 {id:"bai-mot",title:"<img src=x onerror=alert(1)>",category:"Chất đảo",dek:"Một bài đầu",intro:"Đoạn mở",sections:[{heading:"Một đoạn",body:"Đoạn an toàn\n\nĐoạn thứ hai"}],sources:[{label:"Nguồn A"}]},
 {id:"bai-hai",title:"Hồ tiêu Phú Quốc",category:"Ẩm thực",dek:"Bài thứ hai",intro:"Mở bài thứ hai",sections:[{heading:"Nguồn gốc",body:"Chuyện về tiêu"}],sources:[]}
];
d.reset(list,"bai-hai");
assert.equal(d.selected(),1);assert.equal(d.view(),"edit");
assert.equal(d.normalize("Hồ TIÊU Phú Quốc"),"ho tieu phu quoc");
d.reset(list);
assert.equal(d.view(),"read");
const html=d.render(list,()=>"<section>Editor mode</section>","");
assert.match(html,/data-story-reading/);
assert.match(html,/id="storyDeskSearch" data-editor-readonly-action/,"Read-only users can search articles");
assert.match(html,/CHƯA XUẤT BẢN/,"Draft reading must never be mistaken for the public article");
assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;/);
assert.doesNotMatch(html,/<img src=x/);
assert.equal((html.match(/data-story-select="\d+"/g)||[]).length,2);
assert.ok(d.select(1,list.length));
assert.ok(d.setView("outline"));
const outline=d.render(list,()=>"", "");
assert.match(outline,/data-story-outline/);
assert.match(outline,/Nguồn gốc/);
assert.match(outline,/data-story-focus="0"/);
assert.ok(d.setView("edit"));
assert.match(d.render(list,()=>"<section>Editor mode</section>",""),/Editor mode/);
d.query("ho tieu");
assert.match(d.render(list,()=>"", ""),/1 bài phù hợp/);
assert.ok(!d.select(9,list.length),"Cannot select outside catalog");
const photoHtml=d.readHtml({title:"An toàn",image:"/assets/media/editorial-bai-sao-local.jpg",image_caption:"Chú thích bìa",
  image_credit:"Tác giả",cover_position:"top",
  sections:[{heading:"Đoạn thử",body:"Văn bản xuất hiện sau ảnh",image:"/assets/media/editorial-bai-sao-local.jpg",caption:"Ảnh thử",layout:"full"}]});
assert.match(photoHtml,/style="object-position:50% 18%"/);
assert.match(photoHtml,/Chú thích bìa · Tác giả/);
assert.match(photoHtml,/class="story-reading-figure full"/);
assert.ok(photoHtml.indexOf("story-reading-figure full")<photoHtml.indexOf("Văn bản xuất hiện sau ảnh"),
  "CMS review follows published article order: figure before section text");
const pending=d.readHtml({sections:[{heading:"",body:"",image:""}]});
assert.match(pending,/Chưa chọn ảnh cho khối này/);
const pub=readFileSync("admin/index.html","utf8");
assert.match(pub,/story-desk\.js\?v=2/);
assert.match(pub,/story-composer\.js\?v=1/);
assert.match(pub,/story-composer\.css\?v=1/);
assert.match(pub,/story-desk\.css\?v=1/);
const main=readFileSync("admin/admin.js","utf8");
assert.match(main,/OPQStoryDesk\?\.reset/);
assert.match(main,/OPQStoryDesk\?\.render/);
assert.match(main,/renderStoryWorkbench\(story,i\)/); // definition retained; editor data-paths unchanged
console.log("PASS CMS Story Desk: browse one article, read/outline/edit, Unicode search, safe output and edit wiring.");
