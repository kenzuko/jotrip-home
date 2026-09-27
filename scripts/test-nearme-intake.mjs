import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const base="research/near-go/2026-09-26/";
const batches=[
  ["prior-nearme.json",218],
  ["osm-nearme-extra.json",70],
  ["wc-parking-review.json",43],
  ["go-destination-review.json",83],
  ["pharmacy-review.json",52]
];
for(const [file,count] of batches){
  const data=read(base+file);
  assert.equal(data.records.length,count,"Unexpected staging count: "+file);
}
assert.ok(!fs.existsSync("data/intake"),"Private research candidates must not be placed in the copied data/ directory");

const names=fs.readdirSync("data/entities").filter(x=>x.endsWith(".json"));
const entities=names.flatMap(name=>read(path.join("data/entities",name)).entities||[]);
const byId=new Map(entities.map(e=>[e.id,e]));
assert.equal(byId.size,entities.length,"Canonical entity IDs must remain unique");
const batch=read("data/entities/nearme-essential-20260926.json").entities;
const extension=read("data/entities/nearme-essential-extension-20260926.json").entities;
assert.equal(extension.length,23,"Only selected high-value secondary OSM POIs should be added");
const selectedCount=entities.filter(e=>e.id.startsWith("utility_osm_")&&extension.some(s=>s.id===e.id)).length;
assert.equal(selectedCount,23);
for(const item of extension){
  assert.equal(item.verified,false,"OSM candidate may not become first-party verified");
  assert.equal(item.operational_status,"UNKNOWN");
  assert.equal(item.publication_status,"COMMUNITY_CANDIDATE");
  assert.ok(item.source_refs.some(s=>s.license==="ODbL-1.0"),"OSM license must be carried per entity");
}
const totalEssentials=[...batch,...extension];
assert.equal(totalEssentials.length,59);
assert.equal(totalEssentials.filter(e=>e.verified===false).length,42);

assert.equal(batch.length,36,"This batch is a bounded essential subset, never the raw OSM dump");
assert.equal(batch.filter(e=>e.verified===true).length,17);
assert.equal(batch.filter(e=>e.verified===false).length,19);
const shops=["utility_longchau_ham_ninh","utility_longchau_ben_tram","utility_longchau_dt45"];
for(const id of shops){
  const e=byId.get(id);
  assert.equal(e.utility_type,"PHARMACY");
  assert.equal(e.verified,true);
  assert.equal(e.operational_status,"UNKNOWN");
  assert.equal(e.phone_scope,"CHAIN");
  assert.ok(e.address);
  assert.ok(!e.map,"Official store listing must not become a guessed GPS pin");
}
assert.equal(entities.filter(e=>e.id.startsWith("utility_longchau_")).length,8);
const index=read("data/views/location-index.json");
const indexed=new Map(index.documents.map(x=>[x.id,x]));
assert.equal(indexed.size,index.documents.length,"Duplicate location index IDs");
for(const e of totalEssentials)assert.ok(indexed.has(e.id),"Curated entity absent from location index: "+e.id);
for(const id of ["utility_longchau_tran_phu","utility_longchau_an_thoi","utility_longchau_ganh_dau","utility_longchau_suoi_da"]){
  assert.equal(indexed.get(id)?.map,null,"Stale or inferred pharmacy pin must not be published: "+id);
}
assert.ok(indexed.get("utility_longchau_nguyen_trung_truc")?.map,"Previously verified Long Chau position must remain");
const clinic=byId.get("utility_vinmec_duong_dong_clinic");
const hospital=byId.get("utility_vinmec_phuquoc_emergency");
assert.equal(clinic.map.lat,10.2223133,"Do not restore prior inaccurate Dương Đông clinic area pin");
assert.equal(clinic.map.lon,103.9623962);
assert.equal(clinic.map.precision,"site_centroid");
assert.equal(hospital.map.lat,10.336498688188055,"Preserve user-confirmed Vinmec hospital compound pin");
assert.equal(hospital.map.lon,103.85723855555321);
assert.equal(hospital.map.precision,"site_centroid");
assert.ok(hospital.map.note.includes("KHÔNG phải cổng cấp cứu"),"Do not present hospital center as emergency entrance");
for(const id of [clinic.id,hospital.id]){
  assert.deepEqual([indexed.get(id)?.map?.lat,indexed.get(id)?.map?.lon],[byId.get(id).map.lat,byId.get(id).map.lon]);
}
const mapCoverage=read("data/views/map-coverage.json");
const ready=entities.filter(e=>["zone","place","activity","hotel","utility","access"].includes(e.entity_type)&&Number.isFinite(e.map?.lat)&&Number.isFinite(e.map?.lon)&&["site_centroid","exact_entrance","area_anchor","route_anchor"].includes(e.map?.precision)&&e.map.source&&e.map.verified_at);
assert.equal(mapCoverage.summary.ready_count,ready.length,"Map-ready count must follow canonical");
const mappedHotels=ready.filter(e=>e.entity_type==="hotel");
assert.equal(mapCoverage.layers.stay.length,mappedHotels.length,"Do not replace missing canonical hotel GPS with stale view-only coordinates");
for(const e of mappedHotels){
  const doc=mapCoverage.layers.stay.find(x=>x.id===e.id);
  assert.deepEqual([doc?.lat,doc?.lon],[e.map.lat,e.map.lon],"Source-backed hotel pins remain untouched");
}

const priorHotelAudit=read(base+"hotel-stale-geocode-audit.json");
const historicHotels=index.documents.filter(x=>x.entity_type==="hotel");
assert.equal(historicHotels.length,158,"All hotel directory entries must survive the index rebuild");
assert.equal(historicHotels.filter(x=>x.map).length,63,"Only canonical hotel pins may be placed on the map");
assert.equal(priorHotelAudit.records.length,60,"Keep dropped low-confidence hotel geocodes available for later review");
assert.ok(priorHotelAudit.records.every(x=>x.legacy_coordinates.precision!=="exact_entrance"));
assert.ok(priorHotelAudit.records.every(x=>indexed.has(x.id)&&!indexed.get(x.id).map),"No old inaccurate hotel map pin may be silently restored");
assert.equal(index.summary.total,index.documents.length);
assert.equal(index.summary.with_map,index.documents.filter(x=>Number.isFinite(x.map?.lat)&&Number.isFinite(x.map?.lon)).length);
for(const e of totalEssentials.filter(x=>x.verified===false)){
  assert.equal(e.operational_status,"UNKNOWN");
  assert.equal(e.publication_status,"COMMUNITY_CANDIDATE");
  assert.ok(e.source_refs.some(x=>x.license==="ODbL-1.0"&&/^https:\/\/www.openstreetmap.org\//.test(x.url||"")));
  assert.equal(e.map?.precision,"site_centroid");
  const doc=indexed.get(e.id);
  assert.equal(doc?.verified,false,"Community records cannot become verified via indexing");
  assert.equal(doc?.source_license,"ODbL-1.0");
  assert.match(doc.map?.note||"",/chưa xác minh|chưa được kiểm chứng/i,"All OSM candidate maps must disclose uncertainty");
  assert.ok(!e.opening_hours,"Do not invent live hours from OSM");
}
const chargers=batch.filter(e=>e.utility_type==="CHARGING");
const fuels=batch.filter(e=>e.utility_type==="FUEL");
assert.equal(chargers.length,4);
assert.equal(fuels.length,7);
for(const e of chargers){
  assert.ok(e.external_verify_url?.includes("vinfastauto.com"));
  assert.ok(!e.opening_hours,"Charging availability needs first-party live check");
}
const existingFuel=entities.filter(x=>x.utility_type==="FUEL"&&!batch.includes(x));
assert.ok(existingFuel.length>=3,"Keep original fuel records");
const cfg=read("data/go-config.json");
assert.equal(cfg.activities.length,20,"Keep all 17 prior GO options and add exactly 3 public experiences");
for(const id of ["place_sunset_town","place_bai_truong","place_cua_can"]){
  const x=cfg.activities.find(a=>a.entity_id===id);
  assert.ok(x,"Missing curated GO experience "+id);
  assert.ok(byId.has(id),"GO experience must point to canonical place "+id);
  assert.ok(!x.schedule_owner_confirmed,"Do not turn GO visiting suggestions into operator schedule confirmations");
}
assert.equal(cfg.activities.filter(x=>x.entity_id==="place_sunset_town").length,1);
assert.equal(byId.get("place_sunset_town").opening_hours?.source_type,"OPERATOR","Sunset Town public pedestrian schedule must remain operator backed");
assert.ok(cfg.activities.filter(x=>["place_bai_truong","place_cua_can"].includes(x.entity_id)).every(x=>x.soft_window&&!x.operational_binding),"River and beach are visiting suggestions, not operator openings");
const cats=read("data/home-support.json").near_me.categories;
for(const id of ["PHARMACY","FUEL","CHARGING","VEHICLE_REPAIR","LUGGAGE_STORAGE"])assert.ok(cats.some(x=>x.id===id),"Missing Near Me category "+id);
const near=fs.readFileSync("nearme/nearme.js","utf8");
const home=fs.readFileSync("home-nearme-v2.js","utf8");
assert.ok(near.includes('row.entity_type==="utility"'),"Full Near Me must use canonical charging candidates");
assert.ok(near.includes('x.verified!==false&&["exact_entrance","site_centroid"].includes(x.map_precision)'),"Full Near Me must not sort unverified OSM or area anchors by GPS");
assert.ok(near.includes("communityCount"),"Show count of unverified community pins");
assert.ok(near.includes('x.source_license==="ODbL-1.0"'),"Full Near Me must attribute OSM POI data");
assert.ok(near.includes("reliabilityLabel(x)"),"Community data must be labeled in full Near Me");
assert.ok(home.includes("row.verified!==false"),"Homepage must not rank candidate OSM GPS as validated distance");
assert.ok(home.includes('row.source_license==="ODbL-1.0"'),"Homepage must attribute community data");
const expansion=read("data/entities/nearme-essential-extension-20260927.json").entities;
assert.equal(expansion.length,47,"Expansion must be bounded to 47 selected POIs");
assert.ok(expansion.every(x=>x.verified===false&&x.operational_status==="UNKNOWN"&&x.source_refs.some(s=>s.license==="ODbL-1.0")),"Expansion cannot invent verified operator status");
for(const e of expansion)assert.ok(indexed.has(e.id),"Expanded utility missing from generated index: "+e.id);
const expansionB=read("data/entities/nearme-essential-extension-20260927b.json").entities;
assert.equal(expansionB.length,23,"Additional community intake must contain exactly 23 filtered POIs");
assert.ok(expansionB.every(x=>x.verified===false&&x.operational_status==="UNKNOWN"&&x.publication_status==="COMMUNITY_CANDIDATE"&&x.source_refs.some(s=>s.license==="ODbL-1.0")),"No 2026-09-27b candidate may invent business operation or provenance");
for(const e of expansionB)assert.ok(indexed.has(e.id),"New Near Me place absent from location index: "+e.id);
const expansionC=read("data/entities/nearme-essential-extension-20260927c.json").entities;
assert.equal(expansionC.length,10,"Batch C must contain exactly 10 priority community POIs");
for(const e of expansionC){ assert.equal(e.verified,false); assert.equal(e.operational_status,"UNKNOWN"); assert.equal(e.publication_status,"COMMUNITY_CANDIDATE"); assert.ok(indexed.has(e.id),"Batch C missing from generated location index: "+e.id); assert.equal(indexed.get(e.id).source_license,"ODbL-1.0"); }
const osmExport=read("data/open/osm-nearme-phuquoc-2026-09-25.json");
const osmRows=entities.filter(e=>e.verified===false&&e.source_refs?.some(s=>s.license==="ODbL-1.0"));
assert.equal(osmExport.records.length,osmRows.length,"Every published community POI must have ODbL extract provenance");
assert.equal(osmExport.records.length,122,"Public ODbL extract must include all 112 previous + 10 curated market and essentials POIs");
assert.ok(osmExport.license==="ODbL-1.0"&&osmExport.license_url.includes("opendatacommons.org"));
assert.ok(fs.readFileSync("nearme/index.html","utf8").includes("data/open/osm-nearme-phuquoc-2026-09-25.json"),"Public Near Me must expose ODbL provenance");
assert.ok(osmExport.records.every(e=>e.osm_url.startsWith("https://www.openstreetmap.org/")),"OSM dataset must preserve every source URL");
assert.ok(!fs.readFileSync("scripts/build-cloudflare.mjs","utf8").includes('"research",'),"Private research must not enter public Cloudflare bundle");
for(const [id,canonicalId] of [["utility_osm_node_11873236278","utility_dmx_ganhdau_to7"],["utility_osm_node_6483568745","utility_tgdd_73_nvc"]]){
  const community=entities.find(e=>e.id===id),confirmed=entities.find(e=>e.id===canonicalId);
  assert.equal(community?.duplicate_of,canonicalId,"Named community source must be linked to canonical");
  assert.equal(community?.publication_status,"COMMUNITY_CANDIDATE","Preserve immutable ODbL source classification");
  assert.equal(confirmed?.map?.source_license,"ODbL-1.0","Derived brand-pin must preserve OSM credit");
  assert.equal(confirmed?.map?.precision,"site_centroid","Do not claim exact entrance from branded OSM point");
  assert.equal(confirmed?.operational_status,"UNKNOWN","POI matching never establishes live open state");
  assert.equal(indexed.get(id)?.duplicate_of,canonicalId,"Prevent duplicate UI pins");
  assert.equal(indexed.get(canonicalId)?.source_license,"ODbL-1.0","Map attribution must be visible");
}
console.log("Near Me / GO intake QA PASS: 59 essentials, 4 charge points, 10 additional fuel points, 8 Long Chau, 5 named local pharmacies, two recovered Vinmec pins, canonical hotel coverage and 5 staging batches");
