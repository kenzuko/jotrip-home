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
assert(visual.knowledge["knowledge_014_bai-sao"]?.images?.[0]?.url.includes("B%C3%A3i%20Sao%20Beach.jpg"),"Bãi Sao must use the geotagged exact Bãi Sao image");
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
for(const k of ["knowledge_048_song-va-huong-song-quanh-dao","knowledge_079_di-chuyen-duong-dong-ganh-dau","knowledge_080_di-chuyen-duong-dong-rach-vem","knowledge_081_di-chuyen-duong-dong-ham-ninh","knowledge_087_ferry-high-speed-boat-den-phu-quoc","knowledge_112_nghinh-ong"]){
  assert.equal(visual.knowledge[k]?.images?.length,0,k+" stays photo-free until a subject-matched verified image is curated");
}
const ddAt=visual.knowledge["knowledge_078_di-chuyen-duong-dong-an-thoi"]?.images||[];
assert.equal(ddAt.length,1,"Dương Đông - An Thới route keeps only the An Thới endpoint context image");
assert(!JSON.stringify(ddAt).includes("Selling%20fruit"),"Night-market fruit stall must not illustrate an intercity route");
const oldAirport=visual.knowledge["knowledge_139_phu-quoc-truoc-san-bay-quoc-te"]?.images?.[0];
assert(oldAirport?.url.includes("PhuQuocAirport.jpg"),"Pre-international-airport article must use an old Phú Quốc airport image");
assert(/^2009-/.test(oldAirport?.captured_at||""),"Pre-international-airport hero must predate the 2012 international airport opening");
assert(roadTopic.images[1].url.includes("tr%E1%BA%A7n%20h%C6%B0ng")||roadTopic.images[1].url.includes("Tr%E1%BA%A7n%20h%C6%B0ng"),"Road-history second photo should remain the reviewed Trần Hưng Đạo image");
assert(!(visual.knowledge["knowledge_074_cano-tau-cao-toc-pha-khac-nhau-the-nao"]?.images||[]).some(p=>p.url.includes("Female%20motorcyclist")),"Motorcyclist must not illustrate canoe / fast ferry / ferry comparison");
assert(!(visual.knowledge["knowledge_140_duong-dong-truoc-va-sau-do-thi-hoa"]?.images||[]).some(p=>p.url.includes("Selling%20fruit")),"Night-market fruit stall must not stand in for Dương Đông urbanisation");
assert.equal(visual.knowledge["knowledge_142_ham-ninh-truoc-va-sau-chinh-trang"]?.images?.length,1,"Hàm Ninh change story must not present a pre-2019 beach photo as the after view");
assert.equal(visual.food["ca-mu-hap"]?.images?.length,0,"Cá mú card must stay photo-free until an actual cá mú image is verified");
assert(!JSON.stringify(visual.food["tom-mu-ni-nuong"]||{}).toLowerCase().includes("con-dao"),"Phú Quốc slipper-lobster card must not reuse a Côn Đảo photo");
assert(visual.food["tom-mu-ni-nuong"]?.images?.[0]?.url.includes("dac-san-hai-san-phu-quoc-5"),"Slipper-lobster card should use the reviewed exact-dish image from a Phú Quốc food article");
assert(!JSON.stringify(visual.food["com-ghe-ham-ninh"]||{}).includes("trung-duong-marina"),"Hàm Ninh crab-rice card must not imply a Dương Đông restaurant photo is Hàm Ninh");
assert.equal(visual.knowledge["knowledge_023_hon-gam-ghi"]?.images?.length,0,"Hòn Gầm Ghì stays photo-free until the exact island is visually verified");
assert(!(visual.stories["an-thoi-ben-ca-va-cua-ngo-dao"]?.images||[]).some(p=>p.url.startsWith("/assets/media/editorial-fishing-fleet.jpg")),"An Thoi story must not use unidentified fishing-fleet imagery");
assert(!(visual.stories["vi-sao-goi-phu-quoc-la-dao-ngoc"]?.images||[]).some(p=>p.url.startsWith("/assets/media/editorial-")),"Đảo Ngọc story must use verified Phú Quốc imagery, not unidentified cove assets");
assert.equal(visual.places["activity_tour_3_islands"]?.images?.length,1,"3-island activity should keep the real JoTrip canoe image only");
assert.equal(visual.places["activity_snorkeling_an_thoi"]?.images?.length,1,"An Thoi snorkeling should keep the source-reviewed exact activity image only");
assert(visual.places["place_bai_sao"]?.images?.[0]?.url.includes("B%C3%A3i%20Sao%20Beach.jpg"),"Bãi Sao place card must use the same exact geotagged beach image");
for(const k of ["knowledge_050_hoang-hon-phu-quoc","knowledge_131_sunset-watching"]){
  assert(visual.knowledge[k]?.images?.[0]?.url.includes("1%20Phu%20Quoc%20sunset.jpg"),k+" must use a verified Phú Quốc sunset");
}
assert.equal(visual.knowledge["knowledge_124_cano-3-dao"]?.images?.length,1,"Cano 3 đảo guide should use the actual JoTrip canoe image only");
assert(visual.knowledge["knowledge_124_cano-3-dao"].images[0].source_label==="JoTrip","Cano 3 đảo hero must retain JoTrip field provenance");
assert.equal(visual.knowledge["knowledge_130_beach-day"]?.images?.length,2,"Beach-day guide should use two geotagged real Phú Quốc beach photos");
assert(visual.knowledge["knowledge_130_beach-day"].images.every(p=>/commons\.wikimedia\.org/.test(p.url)&&p.rights_status==="CC_VERIFIED"),"Beach-day images must be licensed and verifiable");
assert(!JSON.stringify(visual.knowledge["knowledge_038_san-ho-nam-dao"]||{}).includes("editorial-snorkeling-coral"),"South-coral guide must not use unidentified library snorkeling imagery");
assert(!JSON.stringify(visual.stories["co-bien-phu-quoc-khuat-tu-bo"]||{}).includes("Sea%20grass%20bed.jpg"),"Dahab seagrass image must not remain in the Phú Quốc story gallery");
assert(JSON.stringify(visual).includes("editorial-sunset-town-aerial.jpg"),"Existing branded-attraction imagery is intentionally retained; do not retire it under the product-brand rule");
assert(JSON.stringify(visual).includes("editorial-vinwonders-castle.jpg"),"Existing VinWonders attraction imagery is intentionally retained");
const productImageBlob=JSON.stringify({
  mam:visual.stories["mam-ruoc-an-lien-phu-quoc"],
  pepper:visual.stories["tieu-chin-ngao-duong-phu-quoc"],
  sim:visual.knowledge["knowledge_064_ruou-sim"]
}).toLowerCase();
for(const forbidden of ["sang-loi","sangloi","sáng lợi","r%C6%B0%E1%BB%A3u%20sim%20ph%C3%BA%20qu%E1%BB%91c.jpg"]){
  assert(!productImageBlob.includes(forbidden.toLowerCase()),"Product-brand image must not return: "+forbidden);
}
assert(visual.knowledge["knowledge_064_ruou-sim"]?.images?.[0]?.url.includes("R%20tomentosa%20fruit.jpg"),"Rượu sim guide should use brand-neutral sim fruit imagery");


console.log("Editorial photo curation PASS: 24 editorial assets, 28 library entries, full non-slideshow refresh, subject/location checks");
