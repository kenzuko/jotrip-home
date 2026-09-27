import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const readJson = file => JSON.parse(fs.readFileSync(path.join(process.cwd(), file), "utf8"));
const official = readJson("data/entities/nearme-directory-20260926.json").entities || [];
const communityDoc = readJson("data/openstreetmap/nearme-candidates-20260926.json");
const community = communityDoc.entities || [];
const index = readJson("data/views/location-index.json");
const support = readJson("data/home-support.json");
const nearHtml = fs.readFileSync("nearme/index.html", "utf8");
const nearJs = fs.readFileSync("nearme/nearme.js", "utf8");
const indexed = new Map((index.documents || []).map(item => [item.id, item]));
const ids = rows => rows.map(item => item.id);
const categoryCount = (rows, category) => rows.filter(item => item.utility_type === category).length;

assert.equal(official.length, 17, "The directory intake contains the reviewed 17 source-backed records");
assert.equal(new Set(ids(official)).size, official.length, "Directory IDs are unique");
for (const entity of official) {
  assert.equal(entity.entity_type, "utility");
  assert.equal(entity.verified, true, entity.id + " must have source-verified identity");
  assert.equal(entity.publication_status, "DIRECTORY_REFERENCE");
  assert.equal(entity.operational_status, "UNKNOWN", entity.id + " must not imply live operation");
  assert.ok((entity.source_refs || []).some(source => /^https:\/\//.test(source.url || "")),
    entity.id + " must retain an evidence link");
  assert.ok(!(entity.source_refs || []).some(source => source.license === "ODbL-1.0"),
    entity.id + " must not pull ODbL data into the directory dataset");
  const row = indexed.get(entity.id);
  assert.ok(row, entity.id + " must be emitted into the canonical Near Me index");
  assert.equal(row.entity_type, "utility");
  assert.ok((row.tags || []).includes(entity.utility_type));
  assert.equal(row.operational_status, "UNKNOWN");
  assert.equal(row.publication_status, "DIRECTORY_REFERENCE");
}
for (const entity of official.filter(item => item.map)) {
  assert.doesNotMatch(JSON.stringify(entity.map), /openstreetmap\.org|OpenStreetMap/i,
    entity.id + " must not put an OSM-derived pin into the directory layer");
}
assert.equal(indexed.size, index.documents.length, "Canonical Near Me IDs are unique");

assert.equal(community.length, 42, "The separate OSM intake contains 42 candidates");
assert.equal(new Set(ids(community)).size, community.length, "OSM candidate IDs are unique");
assert.equal(communityDoc.license?.id, "ODbL-1.0");
assert.match(communityDoc.license?.url || "", /opendatacommons\.org\/licenses\/odbl\/1-0/);
assert.match(communityDoc.attribution?.text || "", /OpenStreetMap contributors/);
assert.match(communityDoc.attribution?.url || "", /openstreetmap\.org\/copyright/);
const indexedIds = new Set(index.documents.map(item => item.id));
for (const entity of community) {
  assert.equal(entity.verified, false, entity.id + " remains unverified");
  assert.equal(entity.operational_status, "UNKNOWN", entity.id + " must not claim live status");
  assert.equal(entity.publication_status, "COMMUNITY_CANDIDATE");
  assert.equal("source_audit" in entity, false, "Internal review notes are not shipped in the public OSM feed");
  assert.ok(Array.isArray(entity.source_refs) && entity.source_refs.some(source =>
    source.license === "ODbL-1.0" &&
    /openstreetmap\.org\/(node|way|relation)\//.test(source.url || "") &&
    /OpenStreetMap contributors/.test(source.attribution || "")),
    entity.id + " must include OSM provenance and attribution");
  assert.ok(Number.isFinite(entity.map?.lat) && Number.isFinite(entity.map?.lon));
  assert.ok(entity.map.lat >= 9.5 && entity.map.lat <= 10.7 &&
    entity.map.lon >= 103.5 && entity.map.lon <= 104.5,
    entity.id + " must have a Phu Quoc candidate coordinate");
  assert.equal(indexedIds.has(entity.id), false, entity.id + " must stay outside the canonical location index");
}
assert.equal(categoryCount(community, "FUEL"), 10);
assert.equal(categoryCount(community, "CHARGING"), 4);
assert.equal(categoryCount(community, "PHARMACY"), 5);
const configured = new Set((support.near_me?.categories || []).map(item => item.id));
for (const category of ["FUEL", "CHARGING", "PHARMACY"]) {
  assert.ok(configured.has(category), category + " remains reachable in Near Me controls");
}
assert.equal(index.summary?.by_type?.hotel, 158,
  "The previous 158-hotel directory remains intact after rebuilding the index");
assert.ok(index.summary?.by_type?.utility >= 34,
  "Existing utility directory records and source-backed intake remain in the canonical index");
for (const id of [
  "utility_vinmec_phuquoc_emergency",
  "utility_longchau_tran_phu",
  "utility_fuel_dong_loi_1",
  "utility_vcb_atm_hung_vuong",
  "utility_parking_sunset_nightmarket",
  "utility_toilet_sunset_venice_02",
  "utility_minimart_one_mart_duong_dong"
]) assert.ok(indexed.has(id), "Existing Near Me utility " + id + " must remain indexed");

assert.match(nearHtml, /id="communityResults"/);
assert.match(nearHtml, /OpenStreetMap contributors/);
assert.match(nearHtml, /ODbL 1\.0/);
assert.match(nearJs, /data\/openstreetmap\/nearme-candidates-20260926\.json/);
assert.match(nearJs, /function filteredCommunityRows/);
assert.match(nearJs, /không tính trong bán kính/);
console.log("Near Me intake QA PASS: 17 directory references, 42 separate ODbL candidates, old hotel and utility rows preserved.");
