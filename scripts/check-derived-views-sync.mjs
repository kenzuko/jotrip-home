// Guard committed Near Me views before builds regenerate them.
// This prevents stale checked-in indexes from silently passing CI and later
// being mistaken for the live deployed map or imported back into master sheets.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const read=file=>JSON.parse(fs.readFileSync(file,"utf8"));
const entityFiles=fs.readdirSync("data/entities").filter(f=>f.endsWith(".json")).sort();
const entities=entityFiles.flatMap(f=>read(path.join("data/entities",f)).entities||[]);
const byId=new Map(entities.map(e=>[e.id,e]));
assert.equal(byId.size,entities.length,"Canonical entity IDs are not unique");
const idx=read("data/views/location-index.json");
const map=read("data/views/map-coverage.json");
const validMap=m=>Number.isFinite(m?.lat)&&Number.isFinite(m?.lon);
const mappable=new Set(["zone","place","activity","hotel","utility","access"]);
const precisions=new Set(["exact_entrance","site_centroid","area_anchor","route_anchor"]);
function ready(e){
  const m=e.map||{};
  return validMap(m)&&precisions.has(m.precision)&&
    typeof m.source==="string"&&!!m.source.trim()&&
    typeof m.verified_at==="string"&&!!m.verified_at.trim();
}
function inheritedPlace(e){
  return (e.related_entities||[]).map(id=>byId.get(id)).find(p=>
    p?.entity_type==="place"&&(p.address||validMap(p.map)))||null;
}
const indexedCanonical=entities.filter(e=>{
  if(!["place","activity","hotel","utility"].includes(e.entity_type))return false;
  let address=e.address||null,point=validMap(e.map);
  if(e.entity_type==="activity"){
    const cats=new Set(e.categories||[]);
    const fixed=cats.has("show")||cats.has("cable-car");
    if(!fixed&&!address&&!point)return false;
    if(!address||!point){
      const p=inheritedPlace(e);
      if(p){address=address||p.address||null;point=point||validMap(p.map);}
    }
  }
  return !!address||point;
});
const expectedIds=new Set(indexedCanonical.map(e=>e.id));
assert.equal(expectedIds.size,indexedCanonical.length,"Location source has duplicate ID");
const docs=idx.documents||[];
assert.equal(docs.length,expectedIds.size,
  "Stale location-index: "+docs.length+" docs; "+expectedIds.size+" canonical entries");
const ids=new Set(docs.map(d=>d.id));
assert.equal(ids.size,docs.length,"Duplicate location-index entries");
for(const id of expectedIds)assert.ok(ids.has(id),"Missing location-index entry: "+id);
for(const d of docs){
  const e=byId.get(d.id);
  assert.ok(e,"Orphaned location-index entry: "+d.id);
  assert.equal(d.entity_type,e.entity_type,"Wrong entity type "+d.id);
  assert.equal(d.utility_type||null,e.utility_type||null,"Wrong utility type "+d.id);
  assert.equal(d.verified??null,e.verified??null,"Wrong verified flag "+d.id);
  assert.equal(d.operational_status||null,e.operational_status||null,
    "Wrong operation status "+d.id);
  const isOSM=(e.source_refs||[]).some(s=>s.license==="ODbL-1.0");
  assert.equal(d.source_license||null,isOSM?"ODbL-1.0":null,
    "Lost OSM provenance "+d.id);
  if(validMap(e.map)){
    assert.ok(validMap(d.map),"Missing mapped coordinate "+d.id);
    assert.equal(d.map.lat,e.map.lat,"Wrong latitude "+d.id);
    assert.equal(d.map.lon,e.map.lon,"Wrong longitude "+d.id);
    assert.equal(d.map.precision,e.map.precision,"Wrong coordinate precision "+d.id);
  }
}
const byType={};
for(const d of docs)byType[d.entity_type]=(byType[d.entity_type]||0)+1;
assert.deepEqual(idx.summary.by_type,byType,"Location type totals are stale");
assert.equal(idx.summary.total,docs.length,"Location summary total is stale");
assert.equal(idx.summary.with_map,docs.filter(d=>validMap(d.map)).length,
  "Location mapped total is stale");
assert.equal(idx.summary.with_address,docs.filter(d=>d.address).length,
  "Location address total is stale");
const candidates=entities.filter(e=>mappable.has(e.entity_type));
const yes=candidates.filter(ready);
const no=candidates.filter(e=>!ready(e));
assert.equal(map.summary.candidate_count,candidates.length,
  "Stale map coverage candidate count");
assert.equal(map.summary.ready_count,yes.length,"Stale map coverage ready count");
assert.equal(map.summary.missing_count,no.length,"Stale map coverage missing count");
assert.deepEqual(new Set(map.missing_ids||[]),new Set(no.map(e=>e.id)),
  "Stale map coverage missing IDs");
const layerIds=Object.values(map.layers||{}).flatMap(x=>x.map(y=>y.id));
assert.equal(new Set(layerIds).size,layerIds.length,"Duplicate map layer IDs");
assert.deepEqual(new Set(layerIds),new Set(yes.map(e=>e.id)),
  "Stale map coverage mapped IDs");
for(const e of yes){
  const l=Object.values(map.layers||{}).flat().find(x=>x.id===e.id);
  assert.equal(l.lat,e.map.lat,"Stale map latitude "+e.id);
  assert.equal(l.lon,e.map.lon,"Stale map longitude "+e.id);
  assert.equal(l.precision,e.map.precision,"Stale map precision "+e.id);
}
console.log("Checked-in Near Me views match canonical entities:",{
  documents:docs.length,utilities:byType.utility||0,
  mapped:idx.summary.with_map,map_candidates:candidates.length,
  map_ready:yes.length,map_missing:no.length
});
