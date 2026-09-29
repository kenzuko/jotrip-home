import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source=fs.readFileSync(new URL("../admin/module-validation.js",import.meta.url),"utf8");
const root={};
vm.runInNewContext(source,{window:root,globalThis:root,Set,Number,String,Array});
const validate=root.OPQModuleValidation.validate;

assert.deepEqual([...validate({moduleId:"home",data:{hero:{title:"",lead:""}}})],
  ["Hero cần có tiêu đề.","Hero cần có đoạn dẫn."]);
assert.deepEqual([...validate({moduleId:"home",data:{hero:{title:"Phú Quốc",lead:"Hôm nay"}}})],[]);

const stories={stories:[
  {id:"same",title:"Bài 1",sections:[{heading:"",body:"",image:""}]},
  {id:"same",title:"",sections:[]}
]};
const storyErrors=[...validate({moduleId:"stories",data:stories,selectedStoryIndex:0})];
assert.ok(storyErrors.includes("Bài đang sửa, đoạn 1 đang trống. Thêm ảnh/nội dung hoặc xóa đoạn."));
assert.ok(storyErrors.includes("Mã bài bị trùng: same"));
assert.ok(storyErrors.includes("Bài #2 chưa có tiêu đề."));
assert.ok(storyErrors.some(x=>x.includes("chưa có đoạn nội dung")));
assert.equal(validate({moduleId:"stories",data:stories,selectedStoryIndex:1})
  .some(x=>x.includes("Bài đang sửa, đoạn 1")),false,
  "Only the selected story gets empty-block validation");

assert.deepEqual([...validate({moduleId:"guide",data:{title:"",zones:[{name:""}]}})],
  ["Cẩm nang cần có tiêu đề.","Khu vực #1 chưa có tên."]);
assert.deepEqual([...validate({moduleId:"utilities",data:{national_emergency:[{label:"Công an",phone:""}]}})],
  ["Số khẩn cấp #1 thiếu tên hoặc số điện thoại."]);

const venueErrors=[...validate({moduleId:"venues",data:{entities:[{
  id:"venue_1",name:"Bãi",category:"BAD",status:"ACTIVE",verified_at:"",source_ref:"",
  coordinate_precision:"site_centroid",coordinate_source_ref:"",coordinate_source_type:"official",
  coordinate_observed_at:"bad-date",coordinate_confidence:"UNKNOWN",latitude:100,longitude:200
}]}})];
for(const expected of [
  "Địa điểm “Bãi” chưa chọn đúng loại.",
  "Địa điểm đang dùng cần ngày kiểm tra: Bãi",
  "Địa điểm đang dùng cần nguồn: Bãi",
  "Địa điểm Bãi thiếu nguồn kiểm tra tọa độ.",
  "Địa điểm Bãi thiếu ngày kiểm tra tọa độ.",
  "Địa điểm Bãi cần chọn độ tin cậy tọa độ.",
  "Vĩ độ không hợp lệ: Bãi",
  "Kinh độ không hợp lệ: Bãi"
]) assert.ok(venueErrors.includes(expected),expected);

const users=[...validate({moduleId:"users",data:{users:[
  {login:"Ken",role:"editor",enabled:true},
  {login:"ken",role:"viewer",enabled:true}
]}})];
assert.ok(users.includes("CMS phải còn ít nhất một Admin đang hoạt động."));
assert.ok(users.includes("GitHub username bị trùng: ken"));

assert.deepEqual([...validate({moduleId:"analytics",data:{anything:true}})],[]);
assert.deepEqual([...validate({moduleId:"traffic",data:null})],[]);
console.log("PASS CMS module validation extraction");
