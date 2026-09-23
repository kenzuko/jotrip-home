import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";

const require=createRequire(import.meta.url);
const {normalizeVenue,normalizeZone,phuQuocCoordinates}=require("../nearme/venue-normalizer.js");
const baseline={id:"venue_test",name:"Quán mẫu",category:"LOCAL_FOOD",status:"ACTIVE",source_ref:"first_party"};
const normalize=(changes={})=>normalizeVenue({...baseline,...changes});

assert.equal(normalize({latitude:null,longitude:null}).lat,null,"Missing latitude must never become 0");
assert.equal(normalize({latitude:"",longitude:""}).lon,null,"Blank longitude must never become 0");
assert.equal(normalize({latitude:" ",longitude:"0"}).map,null,"Whitespace and zero longitude are invalid");
assert.equal(normalize({latitude:0,longitude:0}).map,null,"0,0 is not Phu Quoc");
assert.equal(normalize({latitude:10.2172,longitude:null}).map,null,"Incomplete coordinate pairs cannot create pins");
assert.equal(normalize({latitude:10.2172,longitude:103.9593}).map.precision,"unverified","No fabricated location precision");
assert.equal(normalize({latitude:10.2172,longitude:103.9593,geo_precision:"site_centroid"}).map.precision,"site_centroid");
assert.equal(normalize({zone_code:"south"}).zone_id,"zone_south","South filter must match CMS venue");
assert.equal(normalize({zone_code:"duong_dong"}).zone_id,"zone_central_west");
assert.equal(normalize({zone_code:"long_beach"}).zone_id,"zone_central_west");
assert.equal(normalize({zone_code:"north"}).zone_id,"zone_north");
assert.equal(normalizeZone("zone_south"),"zone_south","Already canonical IDs remain stable");
assert.equal(normalize({status:"REVIEW"}),null,"Unreviewed venues must stay hidden");
assert.equal(normalize({status:"CLOSED"}),null,"Closed venues must stay hidden");
assert.deepEqual(phuQuocCoordinates({latitude:11.2172,longitude:103.9593}),{lat:null,lon:null},"Out-of-island pins must not be emitted");
assert.deepEqual(phuQuocCoordinates({latitude:"10.2172",longitude:"103.9593"}),{lat:10.2172,lon:103.9593});

const file=path.join(process.cwd(),"data/entities/destination-venues.json");
const source=JSON.parse(fs.readFileSync(file,"utf8"));
const normalized=(source.entities||[]).map(normalizeVenue).filter(Boolean);
assert.equal(normalized.length,(source.entities||[]).filter(x=>x.status==="ACTIVE"&&x.id&&x.name).length);
for(const venue of normalized){
  assert.equal(typeof venue.id,"string");
  assert.ok(venue.map===null||Number.isFinite(venue.map.lat)&&Number.isFinite(venue.map.lon));
  assert.notDeepEqual([venue.lat,venue.lon],[0,0]);
}
console.log("Near Me venue normalization tests passed:",normalized.length,"active entries and 16 edge cases");
