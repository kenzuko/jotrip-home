import assert from "node:assert/strict";
import {mkdtemp,mkdir,writeFile,readFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {spawnSync} from "node:child_process";
import {classifyForecastFreshness} from "../core/weather-freshness-policy.mjs";
import {observeDynamicIsland} from "../core/en-dynamic-islands-prototype.mjs";

const root=await mkdtemp(join(tmpdir(),"openpq-selector-prototype-"));
const html=extra=>`<!doctype html><html><head><title>x</title></head><body><header>${extra||""}<b>Header</b></header><main>x</main></body></html>`;
for(const rel of ["weather/index.html","transit/index.html","airport/index.html","other/index.html"])await mkdir(join(root,rel.split("/").slice(0,-1).join("/")),{recursive:true});
await writeFile(join(root,"index.html"),html());
await writeFile(join(root,"weather/index.html"),html());
await writeFile(join(root,"transit/index.html"),html());
await writeFile(join(root,"airport/index.html"),html('<select id="languageSelect"><option>VI</option><option>EN</option></select>'));
await writeFile(join(root,"other/index.html"),html());

function runInjector(){
  const run=spawnSync(process.execPath,["scripts/inject-static-language-switcher.mjs",root],{encoding:"utf8"});
  assert.equal(run.status,0,run.stderr||run.stdout);
}
runInjector();
for(const rel of ["index.html","weather/index.html","transit/index.html"]){
  const out=await readFile(join(root,rel),"utf8");
  assert.equal(out.split("data-language-slot").length-1,1,rel+" must have exactly one selector slot");
  assert.equal(out.split("/core/language-switcher.js").length-1,1,rel+" must load selector JS once");
  assert.equal(out.split("/core/language-switcher.css").length-1,1,rel+" must load selector CSS once");
}
const airport=await readFile(join(root,"airport/index.html"),"utf8");
assert.match(airport,/id="languageSelect"/);
assert.doesNotMatch(airport,/data-language-slot|\/core\/language-switcher\.js/);
const other=await readFile(join(root,"other/index.html"),"utf8");
assert.doesNotMatch(other,/data-language-slot|\/core\/language-switcher\.js/);
runInjector();
for(const rel of ["index.html","weather/index.html","transit/index.html"]){
  const out=await readFile(join(root,rel),"utf8");
  assert.equal(out.split("data-language-slot").length-1,1,rel+" injection must be idempotent");
}

const now=Date.parse("2026-10-02T08:00:00+07:00");
let state=classifyForecastFreshness({
  snapshot_generated_at:"2026-10-02T07:40:00+07:00",
  source_cycle_at:"2026-10-02T06:00:00+07:00",
  latest_expected_cycle_at:"2026-10-02T06:00:00+07:00",
  future_coverage_until:"2026-10-03T08:00:00+07:00"
},{now});
assert.deepEqual([state.freshness,state.forecast_valid,state.reason],["FRESH",true,"LATEST_AVAILABLE_CYCLE"]);
state=classifyForecastFreshness({
  snapshot_generated_at:"2026-10-02T04:23:00+07:00",
  source_cycle_at:"2026-10-02T00:00:00+07:00",
  latest_expected_cycle_at:"2026-10-02T06:30:00+07:00",
  future_coverage_until:"2026-10-03T08:00:00+07:00"
},{now,cycleGraceMinutes:120});
assert.deepEqual([state.freshness,state.forecast_valid,state.reason],["AGING",true,"WAITING_NEW_CYCLE"],"204-minute-old snapshot can remain valid while waiting for the next model cycle");
state=classifyForecastFreshness({
  snapshot_generated_at:"2026-10-02T04:23:00+07:00",
  source_cycle_at:"2026-10-02T00:00:00+07:00",
  latest_expected_cycle_at:"2026-10-02T05:00:00+07:00",
  future_coverage_until:"2026-10-03T08:00:00+07:00"
},{now,cycleGraceMinutes:120});
assert.deepEqual([state.freshness,state.forecast_valid,state.reason],["STALE",false,"PIPELINE_DELAY"]);
state=classifyForecastFreshness({
  source_cycle_at:"2026-10-02T06:00:00+07:00",
  future_coverage_until:"2026-10-02T07:59:00+07:00"
},{now});
assert.deepEqual([state.freshness,state.forecast_valid,state.reason],["STALE",false,"COVERAGE_EXPIRED"]);

const translated=[];let callback=null;let rafQueue=[];
class FakeObserver{constructor(cb){callback=cb}observe(target,opts){this.target=target;this.opts=opts}disconnect(){}}
const fakeRoot={};
const handle=observeDynamicIsland(fakeRoot,{translate:n=>translated.push(n),Observer:FakeObserver,raf:fn=>rafQueue.push(fn)});
assert.equal(translated.length,1,"island is translated once at attach time");
const child={nodeType:1};
callback([{type:"childList",addedNodes:[child]},{type:"attributes",target:child}]);
assert.equal(rafQueue.length,1,"multiple mutations are batched into one frame");
rafQueue.shift()();
assert.equal(translated.filter(x=>x===child).length,1,"same dirty node is translated once per frame");
handle.disconnect();

const selectorSource=await readFile("core/language-switcher.js","utf8");
assert.doesNotMatch(selectorSource,/createElement\(["']nav["']\)/,"selector runtime must not invent a nav");
assert.doesNotMatch(selectorSource,/querySelector\(["']\.site-header/,"selector runtime must not guess a header");
const islandSource=await readFile("core/en-dynamic-islands-prototype.mjs","utf8");
assert.doesNotMatch(islandSource,/document\.documentElement/,"scoped observer must not watch the whole document");
const css=await readFile("core/language-switcher.css","utf8");
const js=await readFile("core/language-switcher.js","utf8");
assert.ok(Buffer.byteLength(css)+Buffer.byteLength(js)<12000,"selector prototype JS+CSS budget must stay under 12 KB uncompressed");

await rm(root,{recursive:true,force:true});
console.log("PASS prototype: scoped selector, native Airport exclusion, idempotent build injection, Weather freshness contract, batched EN dynamic islands");
