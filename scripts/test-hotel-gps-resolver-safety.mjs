import assert from "node:assert/strict";
import fs from "node:fs";
import {spawnSync} from "node:child_process";

const path="scripts/geocode-google-maps.mjs";
const source=fs.readFileSync(path,"utf8");
assert.ok(source.includes('mode:"RESEARCH_ONLY"'),"GPS discovery must remain research-only");
assert.ok(source.includes("publication_allowed:false"),"Discovered coordinates must not become publishable automatically");
assert.ok(!/entity\.map\s*=/.test(source),"Research script must never assign canonical entity maps");
assert.ok(!/writeFileSync\(filePath/.test(source),"Research script must never write back a canonical entity file");
assert.ok(source.includes('status:"HOLD_BRAND_MISMATCH"'),"Wrong-name mapped POIs must be held");
assert.ok(source.includes('status:"HOLD_ADDRESS_GEOCODE"'),"Address-only geocode must be held");
assert.ok(source.includes('status:"HOLD_UNNAMED_POI"'),"Unnamed POI must be held");
assert.ok(source.includes('status:"NAMED_CANDIDATE_REVIEW"'),"Even matching named POIs must require independent evidence");
assert.ok(source.includes('source_license_review_required'),"Potential OSM-based candidates must carry a license review flag");
const invoke=(...args)=>spawnSync(process.execPath,[path,...args],{encoding:"utf8",env:{...process.env,GOOGLE_MAPS_API_KEY:""}});
const self=invoke("--self-test");
assert.equal(self.status,0,"Resolver safety self-test failed:\n"+self.stderr);
assert.match(self.stdout,/safety self-test PASS/);
for(const args of [["--force"],["--apply"],["--write"],["--out=../../data/entities/hotels.json"],["--limit=101"]]){
 const r=invoke(...args);
 assert.notEqual(r.status,0,"Unsafe command unexpectedly succeeded: "+args.join(" "));
}
console.log("Hotel GPS research-only gate PASS: no canonical writes, wrong-brand/address hold, no unsafe flags");
