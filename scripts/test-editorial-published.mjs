import assert from "node:assert/strict";
import fs from "node:fs";
import {execFileSync} from "node:child_process";

const get=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const food=get("data/food.json");
const vi=get("data/i18n/vi/food.json");
const stories=get("data/content.json");
const knowledge=get("data/knowledge/objects.json");
const ready=knowledge.objects.filter(x=>x.status==="READY_PUBLIC"&&x.public_ready===true);

assert.equal(food.dishes.length,32,"32 public food articles must remain available");
assert.equal(vi.dishes.length,food.dishes.length,"Vietnamese food data must be synchronized");
assert.deepEqual(vi.dishes,food.dishes,"The localized food articles cannot drift from the public source");
assert.equal(new Set(food.dishes.map(x=>x.id)).size,32,"No duplicate food IDs");
for(const item of food.dishes){
  assert.ok(item.intro.length>100,"Missing readable food lead: "+item.id);
  assert.ok(item.how_to_eat.length>35,"Missing dining guidance: "+item.id);
  assert.ok(Array.isArray(item.ingredients)&&item.ingredients.length,"Ingredients disappeared: "+item.id);
  assert.ok(item.allergy_note,"Allergen note disappeared: "+item.id);
  assert.ok(item.sources?.length,"Food source disappeared: "+item.id);
}
assert.equal(stories.stories.length,34,"24 previously public and 10 reviewed local stories must remain available");
assert.equal(new Set(stories.stories.map(x=>x.id)).size,34,"All 34 story IDs must be unique");
for(const id of ['doc-nhan-nuoc-mam-phu-quoc','cay-di-san-vuon-quoc-gia-phu-quoc']){ const item=stories.stories.find(x=>x.id===id); assert.ok(item,'Published new story missing: '+id); assert.ok(item.image_source_url&&item.image_license_url&&item.image_credit,'Cover image license incomplete: '+id); const visual=JSON.parse(fs.readFileSync('data/visual-context.json','utf8')); assert.ok(visual.stories[id]?.images?.length>=1,'New story gallery incomplete: '+id); assert.ok(visual.stories[id].images.every(photo=>photo.license_url&&photo.source_url&&photo.alt),'Gallery license incomplete: '+id); }
for(const id of ["mam-ruoc-an-lien-phu-quoc","tieu-chin-ngao-duong-phu-quoc"]){ const item=stories.stories.find(x=>x.id===id); assert.ok(item,'New local specialty story missing: '+id); assert.ok(['CC_VERIFIED','SOURCE_ATTRIBUTED_UNLICENSED__RIGHTS_NOT_VERIFIED'].includes(item.image_rights_status),'Cover rights status invalid: '+id); if(item.image_rights_status==='CC_VERIFIED')assert.ok(item.image_license_url,'CC cover requires license link: '+id); assert.ok(item.image_source_url&&item.image_credit,'Cover source credit missing: '+id); const visual=JSON.parse(fs.readFileSync('data/visual-context.json','utf8')); assert.ok(visual.stories[id]?.images?.length>=1,'Specialty gallery incomplete: '+id); assert.ok(visual.stories[id].images.every(photo=>photo.source_url&&photo.source_label&&photo.rights_status),'Photo attribution or rights flag missing: '+id); }
for(const id of ["mang-xe-may-ra-phu-quoc","co-bien-phu-quoc-khuat-tu-bo","canh-nam-tram-phu-quoc-vi-dang-sau-mua","banh-tet-mat-cat-phu-quoc","banh-kheo-phu-quoc-cai-kheo-trong-dang-banh","goi-ca-gioi-hon-mot","cha-ca-nhong-phu-quoc","oc-gai-phu-quoc","bao-ngu-nuong-phu-quoc-than-hong-mo-hanh","goi-xoai-oc-giac-phu-quoc"]){ const story=stories.stories.find(x=>x.id===id); assert.ok(story,'Queued publication missing: '+id); assert.ok(story.image&&story.image_alt&&story.image_credit&&story.image_source_url,'Cover attribution missing: '+id); assert.ok(['CC_VERIFIED','SOURCE_ATTRIBUTED_UNLICENSED__RIGHTS_NOT_VERIFIED'].includes(story.image_rights_status),'Photo rights not marked: '+id); if(story.image_rights_status==='CC_VERIFIED')assert.ok(story.image_license_url,'CC cover requires license link: '+id); const vis=JSON.parse(fs.readFileSync('data/visual-context.json','utf8')).stories[id]; assert.ok(vis&&vis.images.length>=1,'Photo gallery missing: '+id); assert.ok(vis.images.every(p=>p.url&&p.alt&&p.caption&&p.source_url&&p.source_label&&p.rights_status&&(!p.license||p.license_url)),'Gallery sources/rights incomplete: '+id); assert.ok(vis.images.every(p=>p.url!==story.image),'Gallery must not duplicate cover: '+id); }
const visual=JSON.parse(fs.readFileSync("data/visual-context.json","utf8"));assert.ok(Object.keys(visual.food).filter(id=>visual.food[id].images?.length).length>=30,"Food image audit may leave wrong-species or branded cards photo-free; do not restore them merely for coverage");assert.ok(stories.stories.filter(s=>visual.stories[s.id]?.images?.some(p=>p.url&&p.url!==s.image)).length>=33,"Story gallery coverage must remain high without forcing geographically wrong illustrations");assert.ok(Object.values(visual.knowledge).filter(x=>x.images?.length).length>=90,"Guide image quality audit may reduce coverage; do not force mismatched photos to satisfy a historic count");
for(const id of ["knowledge_010_cua-duong","knowledge_011_duong-to","knowledge_015_bai-ong-lang","knowledge_041_chim-o-phu-quoc","knowledge_064_ruou-sim","knowledge_082_bus-phu-quoc","knowledge_117_ba-kim-giao","knowledge_121_phu-quoc-trong-khong-gian-ha-tien","knowledge_144_bac-dao-truoc-va-sau-cac-resort-lon","knowledge_147_duong-sa-phu-quoc-qua-cac-giai-doan"]){const pics=visual.knowledge[id]?.images||[];assert.ok(pics.length,'Missing new guide photo: '+id);assert.ok(pics.every(p=>p.url&&p.alt&&p.caption&&p.source_label&&(!p.license||p.license_url)),'Incomplete photo metadata: '+id);}
const publicGuides=JSON.parse(fs.readFileSync("data/views/knowledge-public.json","utf8"));assert.ok(publicGuides.objects.filter(x=>x.media?.images?.length).length>=90,"Reviewed guide photos must survive the public view build without forcing mismatched imagery");assert.ok(visual.stories["bun-quay-tu-pha-chen-cham"].images.some(x=>x.source_label?.includes("Cổng du lịch Phú Quốc")),"Bún quậy needs a second brand-neutral dish photo");
for(const id of ["knowledge_039_rung-ngap-man-phu-quoc","knowledge_042_rua-bien-quanh-phu-quoc","knowledge_048_song-va-huong-song-quanh-dao","knowledge_112_nghinh-ong","knowledge_023_hon-gam-ghi"]){
  assert.equal(visual.knowledge[id]?.images?.length,0,id+" deliberately remains photo-free until an exact safe image is curated");
}
assert.equal(visual.food["ca-mu-hap"]?.images?.length,0,"Known cá sòng image must not be relabeled as cá mú");
assert.equal(visual.food["tom-tich-rang-muoi"]?.images?.length,0,"Brand-specific tôm tích image must not be restored until a neutral exact dish photo is verified");

for(const item of stories.stories){
  assert.ok(item.dek?.length>60&&item.intro?.length>120,"Story intro incomplete: "+item.id);
  assert.ok(item.sections?.length>0&&item.sections.every(x=>x.body?.length>60),"Story sections disappeared: "+item.id);
  assert.ok(item.sources?.length,"Story source missing: "+item.id);
  assert.ok(item.image,"Story cover missing: "+item.id);
}
assert.equal(ready.length,128,"128 approved guide articles must remain public");
assert.equal(new Set(ready.map(x=>x.topic_id)).size,128,"Guide topic IDs must be stable");
for(const item of ready){
  const e=item.editorial;
  assert.ok(e.short_summary?.length>100,"Guide opening is missing: "+item.topic_id);
  assert.ok(e.practical?.length>60&&e.expectation_vs_reality?.length>60,"Guide article body is incomplete: "+item.topic_id);
  assert.ok(e.before_you_go?.length>0,"Guide safety/practical notes missing: "+item.topic_id);
  assert.ok(item.research?.sources?.length>0,"Guide research references missing: "+item.topic_id);
}
for(const p of ["food/food.js","guide/knowledge.js"]){
  execFileSync(process.execPath,["--check",p],{stdio:"pipe"});
}
for(const p of ["food/index.html","food/article.html"]){
  assert.match(fs.readFileSync(p,"utf8"),/food\.js\?v=20261002-tom-tich-image-r1/);
}
for(const p of ["guide/knowledge.html","guide/article.html"]){
  assert.match(fs.readFileSync(p,"utf8"),/knowledge\.js\?v=20260927-photo-rights-r1/);
}
const foodJs=fs.readFileSync("food/food.js","utf8");
assert.match(foodJs,/ingredientsBlock\(dish\)/);
assert.match(foodJs,/allergenBlock\(dish\)/);
assert.match(foodJs,/renderRandomDish\(/);
console.log("Published editorial regression PASS: 32 food, 34 stories, 128 guides, preserved sources, allergy details and article routes.");