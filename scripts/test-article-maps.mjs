import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read=path=>fs.readFileSync(new URL("../"+path,import.meta.url),"utf8");
const story=JSON.parse(read("data/views/story-locations.json"));
const guide=JSON.parse(read("data/views/knowledge-public.json"));
const visual=JSON.parse(read("data/visual-context.json"));
const content=JSON.parse(read("data/content.json"));
assert.ok(story.count>0,"Story map build must produce locations");
assert.equal(story.count,Object.keys(story.stories).length);
assert.ok(story.stories["nhung-doi-mat-tren-mui-ghe"],"Fishing-boat story should show the An Thoi area");
assert.equal(story.stories["nhung-doi-mat-tren-mui-ghe"].map.precision,"area_anchor");
assert.ok(story.stories["dinh-cau-loi-cau-an"],"The Dinh Cau story needs its own map");
assert.notDeepEqual(story.stories["dinh-cau-loi-cau-an"].map,
  story.stories["nhung-doi-mat-tren-mui-ghe"].map,"Different subjects must not inherit the same region");
const general=["cho-phu-quoc-xoay-lung","vi-sao-goi-phu-quoc-la-dao-ngoc",
  "bun-quay-tu-pha-chen-cham","goi-ca-gioi-hon-mot"];
for(const id of general)assert.ok(!story.stories[id],"No invented location for "+id);
for(const [id,entry] of Object.entries(story.stories)){
  assert.ok(content.stories.some(s=>s.id===id),"Rendered story must exist: "+id);
  const map=entry.map;
  assert.ok(Number.isFinite(map.lat)&&Number.isFinite(map.lon)&&
    map.lat>=9.4&&map.lat<=10.6&&map.lon>=103.4&&map.lon<=104.6,
    "Coordinates must be in the Phu Quoc region: "+id);
  assert.ok(map.source&&map.verified_at,"Every pin has source and verification date");
}
assert.ok(guide.objects.some(o=>o.location?.map),"Published guide must include reviewed location maps");
for(const o of guide.objects){
  if(o.location)assert.ok(o.canonical_entity_id,"No map without canonical entity: "+o.topic_id);
  if(o.topic_type==="FOOD")assert.equal(o.location,null,
    "An island-wide dish should not receive an arbitrary restaurant pin");
}
const ctx={window:{},document:{}};
vm.runInNewContext(read("visual-context.js"),ctx);
const {locator}=ctx.window.OpenPQVisual;
const map=story.stories["nhung-doi-mat-tren-mui-ghe"].map;
const html=locator(null,{label:"Bến cá & không gian nghề biển",map});
assert.match(html,/<iframe /,"Maps must be embedded without a click");
assert.match(html,/loading="lazy"/,"Off-screen maps should defer network loading");
assert.match(html,/output=embed/,"Use the built-in keyless map embed");
assert.doesNotMatch(html,/data-lazy-map/,"Do not render click-only placeholders");
assert.match(html,/không phải vị trí chính xác/,"Area anchors must be labeled honestly");
assert.equal(locator(null,{label:"No map",map:{lat:0,lon:0}}),"",
  "Unverified or invalid maps must not show a blank map frame");
const storyPage=read("stories/story.js");
assert.match(storyPage,/storyLocations\?\.stories/,"Story renderer must use reviewed pin feed");
const guidePage=read("guide/knowledge.js");
assert.match(guidePage,/o\.location\?\.map/,"Guide renderer must use reviewed article maps");
console.log("Article maps PASS:",story.count,"reviewed stories,",
  guide.objects.filter(o=>o.location).length,"geolocated guide articles, auto embeds verified");
