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
console.log("Editorial photo curation PASS: 24 editorial assets, 28 library entries, full non-slideshow refresh, subject/location checks");
