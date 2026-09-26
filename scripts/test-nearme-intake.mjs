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
for(const e of batch)assert.ok(indexed.has(e.id),"Curated entity absent from location index: "+e.id);
for(const id of ["utility_longchau_tran_phu","utility_longchau_an_thoi","utility_longchau_ganh_dau","utility_longchau_suoi_da"]){
  assert.equal(indexed.get(id)?.map,null,"Stale or inferred pharmacy pin must not be published: "+id);
}
assert.ok(indexed.get("utility_longchau_nguyen_trung_truc")?.map,"Previously verified Long Chau position must remain");
assert.equal(index.summary.total,index.documents.length);
assert.equal(index.summary.with_map,index.documents.filter(x=>Number.isFinite(x.map?.lat)&&Number.isFinite(x.map?.lon)).length);
for(const e of batch.filter(x=>x.verified===false)){
  assert.equal(e.operational_status,"UNKNOWN");
  assert.equal(e.publication_status,"COMMUNITY_CANDIDATE");
  assert.ok(e.source_refs.some(x=>x.license==="ODbL-1.0"&&/^https:\/\/www.openstreetmap.org\//.test(x.url||"")));
  assert.equal(e.map?.precision,"site_centroid");
  const doc=indexed.get(e.id);
  assert.equal(doc?.verified,false,"Community records cannot become verified via indexing");
  assert.equal(doc?.source_license,"ODbL-1.0");
  assert.ok(doc.map?.note?.includes("Chưa xác minh"));
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
assert.equal(cfg.activities.length,17,"Existing GO choices must be preserved");
const cats=read("data/home-support.json").near_me.categories;
for(const id of ["PHARMACY","FUEL","CHARGING","VEHICLE_REPAIR","LUGGAGE_STORAGE"])assert.ok(cats.some(x=>x.id===id),"Missing Near Me category "+id);
const near=fs.readFileSync("nearme/nearme.js","utf8");
const home=fs.readFileSync("home-nearme-v2.js","utf8");
assert.ok(near.includes('row.entity_type==="utility"'),"Full Near Me must use canonical charging candidates");
assert.ok(near.includes("reliabilityLabel(x)"),"Community data must be labeled in full Near Me");
assert.ok(home.includes("row.verified!==false"),"Homepage must not rank candidate OSM GPS as validated distance");
assert.ok(!fs.readFileSync("scripts/build-cloudflare.mjs","utf8").includes('"research",'),"Private research must not enter public Cloudflare bundle");
console.log("Near Me / GO intake QA PASS: 36 essentials, 4 charge points, 7 fuel points, 8 Long Chau, all 5 staging batches and legacy GO choices");
