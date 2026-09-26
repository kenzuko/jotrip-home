import assert from "node:assert/strict";
import fs from "node:fs";
import {execFileSync} from "node:child_process";

const get=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const food=get("data/food.json");
const vi=get("data/i18n/vi/food.json");
const stories=get("data/content.json");
const knowledge=get("data/knowledge/objects.json");
const ready=knowledge.objects.filter(x=>x.status==="READY_PUBLIC"&&x.public_ready===true);

assert.equal(food.dishes.length,32,"32 public food articles must remain available");
assert.equal(vi.dishes.length,food.dishes.length,"Vietnamese food data must be synchronized");
assert.deepEqual(vi.dishes,food.dishes,"The localized food articles cannot drift from the public source");
assert.equal(new Set(food.dishes.map(x=>x.id)).size,32,"No duplicate food IDs");
for(const item of food.dishes){
  assert.ok(item.intro.length>100,"Missing readable food lead: "+item.id);
  assert.ok(item.how_to_eat.length>35,"Missing dining guidance: "+item.id);
  assert.ok(Array.isArray(item.ingredients)&&item.ingredients.length,"Ingredients disappeared: "+item.id);
  assert.ok(item.allergy_note,"Allergen note disappeared: "+item.id);
  assert.ok(item.sources?.length,"Food source disappeared: "+item.id);
}
assert.equal(stories.stories.length,20,"20 original stories must remain available");
assert.equal(new Set(stories.stories.map(x=>x.id)).size,20,"Story IDs must be stable");
for(const item of stories.stories){
  assert.ok(item.dek?.length>60&&item.intro?.length>120,"Story intro incomplete: "+item.id);
  assert.ok(item.sections?.length>0&&item.sections.every(x=>x.body?.length>60),"Story sections disappeared: "+item.id);
  assert.ok(item.sources?.length,"Story source missing: "+item.id);
  assert.ok(item.image,"Story cover missing: "+item.id);
}
assert.equal(ready.length,128,"128 approved guide articles must remain public");
assert.equal(new Set(ready.map(x=>x.topic_id)).size,128,"Guide topic IDs must be stable");
for(const item of ready){
  const e=item.editorial;
  assert.ok(e.short_summary?.length>100,"Guide opening is missing: "+item.topic_id);
  assert.ok(e.practical?.length>60&&e.expectation_vs_reality?.length>60,"Guide article body is incomplete: "+item.topic_id);
  assert.ok(e.before_you_go?.length>0,"Guide safety/practical notes missing: "+item.topic_id);
  assert.ok(item.research?.sources?.length>0,"Guide research references missing: "+item.topic_id);
}
for(const p of ["food/food.js","guide/knowledge.js"]){
  execFileSync(process.execPath,["--check",p],{stdio:"pipe"});
}
for(const p of ["food/index.html","food/article.html"]){
  assert.match(fs.readFileSync(p,"utf8"),/food\.js\?v=20260926-human-editorial-r3/);
}
for(const p of ["guide/knowledge.html","guide/article.html"]){
  assert.match(fs.readFileSync(p,"utf8"),/knowledge\.js\?v=20260926-human-editorial-r1/);
}
const foodJs=fs.readFileSync("food/food.js","utf8");
assert.match(foodJs,/ingredientsBlock\(dish\)/);
assert.match(foodJs,/allergenBlock\(dish\)/);
assert.match(foodJs,/renderRandomDish\(/);
console.log("Published editorial regression PASS: 32 food, 20 stories, 128 guides, preserved sources, allergy details and article routes.");
