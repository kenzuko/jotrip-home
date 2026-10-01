import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const entityFiles=fs.readdirSync("data/entities").filter(f=>f.endsWith(".json")).sort();
const utilities=entityFiles.flatMap(f=>{
  const doc=JSON.parse(fs.readFileSync(path.join("data/entities",f),"utf8"));
  return (doc.entities||[]).filter(e=>e.entity_type==="utility");
});
const enrichment=JSON.parse(fs.readFileSync("data/utility-enrichment.json","utf8"));
const byId=new Map(utilities.map(x=>[x.id,x]));

assert.equal(byId.size,utilities.length,"Duplicate canonical utility IDs");
assert.equal(enrichment.schema_version,"1.0","Unexpected utility enrichment schema version");
assert.ok(Array.isArray(enrichment.entries),"Utility enrichment entries must be an array");
assert.ok(Array.isArray(enrichment.conflicts),"Utility enrichment conflicts must be an array");
assert.equal(enrichment.coverage?.canonical_utilities,utilities.length,"Utility enrichment canonical coverage mismatch");
assert.equal(enrichment.coverage?.batch_entries,enrichment.entries.length,"Utility batch entry count mismatch");

const seen=new Set();
for(const row of enrichment.entries){
  assert.ok(row&&typeof row==="object","Invalid utility enrichment row");
  assert.ok(typeof row.id==="string"&&row.id,"Utility enrichment row missing id");
  assert.ok(byId.has(row.id),"Orphan utility enrichment id: "+row.id);
  assert.ok(!seen.has(row.id),"Duplicate utility enrichment id: "+row.id);
  seen.add(row.id);
  assert.ok(!("map" in row)&&!("gps" in row),"Utility enrichment must not carry/promote GPS: "+row.id);

  const op=row.operations;
  assert.ok(op&&typeof op==="object","Missing operations block: "+row.id);
  assert.equal(op.status,"ACTIVE_CONFIRMED","Unexpected operation state: "+row.id);
  assert.match(op.checked_at||"",/^\\d{4}-\\d{2}-\\d{2}$/,"Missing operation checked_at: "+row.id);
  assert.ok(/^https?:\\/\\//.test(op.source_url||""),"Missing operation source URL: "+row.id);

  const canonical=byId.get(row.id);
  assert.equal(canonical.operational_status,"ACTIVE_CONFIRMED","Canonical operation status not promoted: "+row.id);
  assert.equal(canonical.source_audit?.verified_operation,true,"Canonical verified_operation missing: "+row.id);
  assert.equal(canonical.source_audit?.operation_review_at,op.checked_at,"Operation review date mismatch: "+row.id);
  assert.equal(canonical.source_audit?.operation_source_url,op.source_url,"Operation source mismatch: "+row.id);

  if(op.opening_hours){
    assert.deepEqual(canonical.opening_hours,op.opening_hours,"Canonical opening hours mismatch: "+row.id);
    assert.ok(Array.isArray(op.opening_hours.windows)&&op.opening_hours.windows.length>0,"Opening windows missing: "+row.id);
    for(const w of op.opening_hours.windows){
      assert.match(w.start||"",/^(?:[01]\\d|2[0-3]):[0-5]\\d$/,"Invalid opening start: "+row.id);
      assert.match(w.end||"",/^(?:[01]\\d|2[0-3]):[0-5]\\d$/,"Invalid opening end: "+row.id);
    }
  }
  for(const contact of row.contacts||[]){
    assert.equal(contact.type,"phone","Unexpected utility contact type: "+row.id);
    assert.ok(typeof contact.value==="string"&&contact.value.trim(),"Empty utility phone: "+row.id);
    assert.ok(/^https?:\\/\\//.test(contact.source_url||""),"Missing utility contact source: "+row.id);
  }
}
console.log("Utility enrichment contract PASS:",{
  utilities:utilities.length,
  enriched:enrichment.entries.length,
  opening_hours:enrichment.coverage.opening_hours_structured
});
