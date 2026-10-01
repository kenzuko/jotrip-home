import assert from "node:assert/strict";
import fs from "node:fs";

const hotels=JSON.parse(fs.readFileSync("data/entities/hotels.json","utf8")).entities||[];
const enrichment=JSON.parse(fs.readFileSync("data/hotel-enrichment.json","utf8"));
const byId=new Map(hotels.map(x=>[x.id,x]));
assert.equal(byId.size,hotels.length,"Duplicate canonical hotel IDs");
assert.equal(enrichment.schema_version,"1.0","Unexpected hotel enrichment schema version");
assert.ok(Array.isArray(enrichment.entries),"Hotel enrichment entries must be an array");
assert.ok(Array.isArray(enrichment.conflicts),"Hotel enrichment conflicts must be an array");
assert.equal(enrichment.coverage?.canonical_hotels,hotels.length,"Hotel enrichment canonical coverage mismatch");
assert.equal(enrichment.coverage?.research_pass_complete,hotels.length,"Hotel research pass must cover all canonical hotels");
assert.equal(enrichment.coverage?.enriched_entries,enrichment.entries.length,"Hotel enrichment entry coverage mismatch");
assert.equal(enrichment.coverage?.canonical_only_no_additional_public_evidence,hotels.length-enrichment.entries.length,
  "Hotel canonical-only coverage mismatch");

const rejectedHosts=new Set([
  "ngocchauhotel.com",
  "phuclochotel.com",
  "www.phuquocsunrise.vn",
  "phuquocsunrise.vn",
  "seahorsebayphuquoc.com",
  "www.seahorsebayphuquoc.com",
  "www.edenresort.com.vn",
  "edenresort.com.vn"
]);
const seen=new Set();
for(const row of enrichment.entries){
  assert.ok(row&&typeof row==="object","Invalid hotel enrichment row");
  assert.ok(typeof row.id==="string"&&row.id,"Hotel enrichment row missing id");
  assert.ok(byId.has(row.id),"Orphan hotel enrichment id: "+row.id);
  assert.ok(!seen.has(row.id),"Duplicate hotel enrichment id: "+row.id);
  seen.add(row.id);

  if(row.website){
    assert.equal(row.website.scope,"operator_or_owner","Unexpected website scope: "+row.id);
    assert.equal(row.website.verified_at,"2026-10-01","Missing website verification date: "+row.id);
    assert.ok(/^https?:\/\//.test(row.website.value),"Invalid website URL: "+row.id);
    const host=new URL(row.website.value).hostname.toLowerCase();
    assert.ok(!rejectedHosts.has(host),"Rejected/stale hotel domain promoted: "+row.id+" "+host);
    assert.equal(byId.get(row.id).website,row.website.value,
      "Canonical website does not match verified enrichment: "+row.id);
  }

  for(const contact of row.contacts||[]){
    assert.ok(["phone","email"].includes(contact.type),"Invalid contact type: "+row.id);
    assert.ok(typeof contact.value==="string"&&contact.value.trim(),"Empty contact value: "+row.id);
    assert.ok(typeof contact.scope==="string"&&contact.scope.trim(),"Missing contact scope: "+row.id);
    assert.ok(/^https?:\/\//.test(contact.source_url||""),"Missing contact source URL: "+row.id);
  }

  for(const cap of row.capacity||[]){
    assert.ok(Number.isFinite(cap.value)&&cap.value>0,"Invalid capacity value: "+row.id);
    assert.ok(typeof cap.unit==="string"&&cap.unit.trim(),"Missing capacity unit: "+row.id);
    assert.ok(typeof cap.scope==="string"&&cap.scope.trim(),"Missing capacity scope: "+row.id);
    assert.ok(/^https?:\/\//.test(cap.source_url||""),"Missing capacity source URL: "+row.id);
  }

  for(const claim of row.star_claims||[]){
    assert.ok(Number.isFinite(claim.value)&&claim.value>0&&claim.value<=5,
      "Invalid star claim: "+row.id);
    assert.ok(typeof claim.scope==="string"&&claim.scope.trim(),"Missing star claim scope: "+row.id);
    assert.ok(/^https?:\/\//.test(claim.source_url||""),"Missing star claim source URL: "+row.id);
  }
  for(const claim of row.amenity_claims||[]){
    assert.ok(Array.isArray(claim.values)&&claim.values.length>0,"Empty amenity claim: "+row.id);
    assert.ok(claim.values.every(x=>typeof x==="string"&&x.trim()),"Invalid amenity value: "+row.id);
    assert.ok(/^https?:\/\//.test(claim.source_url||""),"Missing amenity source URL: "+row.id);
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(claim.checked_at||""),"Missing amenity checked_at: "+row.id);
  }
  if(row.operations){
    assert.equal(typeof row.operations,"object","Invalid operations object: "+row.id);
    for(const [key,value] of Object.entries(row.operations)){
      assert.ok(typeof value==="string"&&value.trim(),"Invalid operation value "+key+": "+row.id);
    }
  }
}
for(const issue of enrichment.conflicts){
  assert.ok(byId.has(issue.id),"Orphan hotel conflict id: "+issue.id);
  assert.ok(["P0","P1","P2"].includes(issue.priority),"Invalid hotel conflict priority: "+issue.id);
  assert.ok(typeof issue.rule==="string"&&issue.rule.trim(),"Hotel conflict missing fail-closed rule: "+issue.id);
  assert.ok(/^https?:\/\//.test(issue.source_url||""),"Hotel conflict missing source URL: "+issue.id);
}
console.log("Hotel enrichment contract PASS:",{
  hotels:hotels.length,
  enriched:enrichment.entries.length,
  conflicts:enrichment.conflicts.length
});
