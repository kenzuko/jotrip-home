import assert from "node:assert/strict";
import fs from "node:fs";

const articles=JSON.parse(fs.readFileSync("data/food.json","utf8"));
const entities=JSON.parse(fs.readFileSync("data/entities/food.json","utf8"));
const schema=JSON.parse(fs.readFileSync("cms/schema.json","utf8"));
const publish=fs.readFileSync("functions/api/cms/publish.js","utf8");

assert.equal(articles.dishes.length,30,"Review the expanded food article inventory");
assert.equal(entities.entities.length,31,"Review food entity mappings, including the existing unmatched ghẹ record");

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
  assert.ok(Array.isArray(article.meal_times)&&article.meal_times.length,"Missing meal-time filter tags: "+article.id);
}
const unmatched=entities.entities.filter(entity=>!articles.dishes.some(article=>article.id===entity.legacy_id));
assert.deepEqual(unmatched,[],"Every mapped food entity should now have a public food article");
assert.ok(schema.modules.some(module=>module.id==="foods"&&module.path==="data/entities/food.json"));
assert.match(publish,/"data\/entities\/food\.json":\["admin","editor"\]/);
console.log("Food mapping passed: 30 food articles have unique entity mappings and meal-time tags.");
