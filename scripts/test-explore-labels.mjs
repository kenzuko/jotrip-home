import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const app=fs.readFileSync(new URL("../explore/app.js",import.meta.url),"utf8");
const match=app.match(/const labels=({[\\s\\S]*?});/);
assert.ok(match,"Explore category labels must be defined");
const labels=vm.runInNewContext("("+match[1]+")");
const ids=["places","activities"];
const tags=new Set();
for(const id of ids){
  const payload=JSON.parse(fs.readFileSync(new URL("../data/entities/"+id+".json",import.meta.url),"utf8"));
  for(const item of payload.entities||[]){
    for(const tag of [...(item.categories||[]),...(item.intents||[])]) tags.add(tag.toLowerCase());
  }
}
const missing=[...tags].filter(tag=>!labels[tag]||!String(labels[tag]).trim());
assert.deepEqual(missing,[],"All published Explore categories must have Vietnamese display labels");
assert.equal(labels.viewpoint,"Điểm ngắm cảnh");
assert.equal(labels.culture,"Văn hóa");
assert.equal(labels["sunset-town"],"Sunset Town","Keep destination names intact");
console.log("Explore labels validated:",tags.size,"published category and intent keys localized.");
