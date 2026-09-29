import assert from "node:assert/strict";
import fs from "node:fs";
import {spawnSync} from "node:child_process";

const config=JSON.parse(fs.readFileSync("cms/translation-pipeline.json","utf8"));
const lifecycle=JSON.parse(fs.readFileSync("cms/translation-lifecycle.json","utf8"));
const expected=["ui","stories","knowledge","food"];
assert.deepEqual(Object.keys(config.families),expected);
assert.deepEqual(lifecycle.families.map(x=>x.id).sort(),[...expected].sort());
for(const [id,family] of Object.entries(config.families)){
  assert.ok(fs.existsSync(family.source_path),id+" source missing");
  assert.match(family.target_path_pattern,/\{locale\}/,id+" target pattern must contain locale");
}
for(const locale of lifecycle.target_locales.map(x=>x.code))assert.ok(config.azure_locale_map[locale],"Missing Azure locale map: "+locale);
const run=spawnSync(process.execPath,["scripts/i18n-pipeline.mjs","inventory"],{encoding:"utf8"});
assert.equal(run.status,0,run.stderr);
const inventory=JSON.parse(run.stdout);
assert.deepEqual(inventory.families.map(x=>x.family),expected);
assert.ok(inventory.families.every(x=>x.fields>0&&x.characters>0));
const targetExistsBefore=fs.existsSync("data/i18n/en/food.json");
const plan=spawnSync(process.execPath,["scripts/i18n-pipeline.mjs","plan","--family","food","--locale","en"],{encoding:"utf8"});
assert.equal(plan.status,0,plan.stderr);
const payload=JSON.parse(plan.stdout);
assert.equal(payload.mode,"plan_only");
assert.ok(payload.characters>0&&payload.azure_requests_at_most>0);
assert.equal(fs.existsSync("data/i18n/en/food.json"),targetExistsBefore,"Plan must not create or remove target files");
console.log("PASS i18n pipeline: inventory, locale map, dry-run and no-write guard");
