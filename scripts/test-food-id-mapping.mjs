import assert from "node:assert/strict";
import fs from "node:fs";

const articles=JSON.parse(fs.readFileSync("data/food.json","utf8"));
const entities=JSON.parse(fs.readFileSync("data/entities/food.json","utf8"));
const schema=JSON.parse(fs.readFileSync("cms/schema.json","utf8"));
const publish=fs.readFileSync("functions/api/cms/publish.js","utf8");

assert.equal(articles.dishes.length,5,"Legacy food article count changed; review the mapping intentionally");
assert.equal(entities.entities.length,6,"Food entity inventory changed; review the mapping intentionally");

const byLegacy=new Map();
const ids=new Set();
for(const entity of entities.entities){
  assert.equal(entity.entity_type,"food");
  assert.ok(entity.id.startsWith("food_"));
  assert.ok(entity.legacy_id);
  assert.ok(entity.name);
  assert.ok(Array.isArray(entity.source_refs)&&entity.source_refs.length>0);
  assert.ok(!ids.has(entity.id),"Duplicate food_id: "+entity.id);
  assert.ok(!byLegacy.has(entity.legacy_id),"Duplicate legacy_id: "+entity.legacy_id);
  ids.add(entity.id);
  byLegacy.set(entity.legacy_id,entity);
}
for(const article of articles.dishes){
  assert.ok(byLegacy.has(article.id),"Legacy article has no ID mapping: "+article.id);
}
const unmatched=entities.entities.filter(entity=>!articles.dishes.some(article=>article.id===entity.legacy_id));
assert.deepEqual(unmatched.map(entity=>entity.id),["food_ghe_ham_ninh"],
  "An unmatched entity is a content gap; do not generate or attach an article automatically");
assert.ok(schema.modules.some(module=>module.id==="foods"&&module.path==="data/entities/food.json"));
assert.match(publish,/"data\/entities\/food\.json":\["admin","editor"\]/);
console.log("Food mapping passed: 5 legacy articles map by ID; ghẹ Hàm Ninh remains an explicit unmapped entity.");
