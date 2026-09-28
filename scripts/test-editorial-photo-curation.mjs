import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),"utf8"));
const visual=read("data/visual-context.json");
const library=read("data/photo-library.json");
const expected={
  "knowledge_029_chua-ho-quoc":"editorial-ho-quoc-overview.webp",
  "knowledge_136_vinwonders-visit":"editorial-vinwonders-castle.jpg",
  "knowledge_127_snorkeling":"editorial-snorkeling-coral.jpg",
  "knowledge_038_san-ho-nam-dao":"editorial-snorkeling-coral.jpg",
  "knowledge_124_cano-3-dao":"editorial-may-rut-island.jpg",
  "knowledge_130_beach-day":"editorial-tropical-beach.jpg",
  "knowledge_050_hoang-hon-phu-quoc":"editorial-fishing-boat-sunset.jpg",
  "knowledge_131_sunset-watching":"editorial-fishing-boat-sunset.jpg",
  "knowledge_149_tau-ca-va-nghe-bien-thay-doi-the-nao":"editorial-fishing-fleet.jpg"
};
for(const [topic,file] of Object.entries(expected)){
  assert.equal(visual.knowledge[topic]?.images?.[0]?.url,"/assets/media/"+file,topic);
}
for(const topic of ["knowledge_024_may-rut-trong","knowledge_025_may-rut-ngoai"]){
  assert.equal(visual.knowledge[topic]?.images?.length,0,topic+" must not use an unidentified island photo");
}
assert(visual.stories["an-thoi-ben-ca-va-cua-ngo-dao"]?.images?.length,"An Thoi contextual gallery");
assert(visual.stories["vi-sao-goi-phu-quoc-la-dao-ngoc"]?.images?.length,"Island story contextual gallery");
assert.equal(library.items.length,28,"Curated photo library includes the full non-slideshow refresh plus previously staged photos");
for(const item of library.items){
  assert(!/^shutterstock_/i.test(item.original_filename),"Stock photo excluded: "+item.id);
  if(item.id.startsWith("editorial-")) assert(!item.used_on.some(x=>x.includes("homepage-hero")),"New editorial photos do not alter slideshow");
  assert(fs.existsSync(path.join(root,item.path.replace(/^\//,""))),"Missing media file: "+item.path);
}
const added=library.items.filter(x=>x.path.startsWith("/assets/media/editorial-"));
assert.equal(added.length,24,"Expected twenty-four approved non-Shutterstock editorial assets");
for(const [topic,record] of Object.entries(visual.knowledge)){
  for(const pic of record?.images||[]){
    assert(pic.url&&pic.alt&&pic.caption&&pic.source_label,topic+" incomplete photo metadata");
    assert(!pic.url.toLowerCase().includes("shutterstock"),"Disallowed stock image");
  }
}
assert(!JSON.stringify(visual.knowledge["knowledge_035_sao-bien-rach-vem"]||{}).includes("starfish-beach-jo-library"),"Do not promote photographed starfish out of water");
assert.equal(visual.knowledge["knowledge_014_bai-sao"]?.images?.[0]?.url,"/assets/media/editorial-bai-sao-local.jpg","Bãi Sao should use the matching local image");
assert.equal(visual.knowledge["knowledge_013_bai-khem"]?.images?.[0]?.url,"/assets/media/editorial-bai-khem-local.jpg","Bãi Khem should use the matching local image");
assert.equal(visual.knowledge["knowledge_005_sunset-town"]?.images?.[0]?.url,"/assets/media/editorial-sunset-town-aerial.jpg","Sunset Town should use the matching local image");
const roadTopic=visual.knowledge["knowledge_147_duong-sa-phu-quoc-qua-cac-giai-doan"];
assert(roadTopic?.images?.length>=2,"Road-history article must retain two visually reviewed real photos");
assert(roadTopic.images[0].url.includes("H%C3%A0m%20Ninh")&&roadTopic.images[0].url.includes("%C4%91%E1%BA%A5t"),"Road-history hero must be the visually reviewed Hàm Ninh dirt-road photo");
assert(!JSON.stringify(roadTopic).includes("Nguyen%20Van%20cu%2C%20TL%2046%2CDuong%20to%20Phu%20quoc"),"Known mislabeled Hà Nội gate photo must never return");
assert(!JSON.stringify(visual).includes("Nguyen%20Van%20cu%2C%20TL%2046%2CDuong%20to%20Phu%20quoc"),"Known mislabeled Hà Nội gate photo must be absent from the entire visual catalog");
const guidePixels=JSON.stringify(visual.knowledge);
for(const forbidden of ["Sea%20grass%20bed.jpg","Can%20Gio%20mangrove%20forest.jpg","Chelonia%20mydas%20in%20tidepools%20at%20Kona.jpg","Newone%20-%20VinBus%2002.jpg"]){
  assert(!guidePixels.includes(forbidden),"Non-Phú-Quốc illustration must not be used as a guide hero: "+forbidden);
}
assert.equal(visual.knowledge["knowledge_039_rung-ngap-man-phu-quoc"]?.images?.length,0,"Mangrove guide stays photo-free until an exact Phú Quốc image with acceptable rights is curated");
assert.equal(visual.knowledge["knowledge_042_rua-bien-quanh-phu-quoc"]?.images?.length,0,"Sea-turtle guide stays photo-free until an exact Phú Quốc image with acceptable rights is curated");
assert(visual.knowledge["knowledge_082_bus-phu-quoc"]?.images?.[0]?.url.includes("photo.znews.vn"),"Bus guide should use a real Phú Quốc bus photo, not a Hà Nội vehicle illustration");
assert(roadTopic.images[1].url.includes("tr%E1%BA%A7n%20h%C6%B0ng")||roadTopic.images[1].url.includes("Tr%E1%BA%A7n%20h%C6%B0ng"),"Road-history second photo should remain the reviewed Trần Hưng Đạo image");
console.log("Editorial photo curation PASS: 24 editorial assets, 28 library entries, full non-slideshow refresh, subject/location checks");
