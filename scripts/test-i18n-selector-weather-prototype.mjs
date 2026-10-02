import assert from "node:assert/strict";
import {mkdtemp,mkdir,writeFile,readFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {spawnSync} from "node:child_process";
import {classifyForecastFreshness,deriveForecastFreshnessContract} from "../core/weather-freshness-policy.mjs";
import {observeDynamicIsland} from "../core/en-dynamic-islands-prototype.mjs";

const root=await mkdtemp(join(tmpdir(),"openpq-selector-prototype-"));
const homeHtml=()=>`<!doctype html><html><head><title>x</title></head><body><aside class="app-left-rail"><div class="app-rail-modules"><a>Weather</a></div></aside><header class="site-header"><a class="brand">Logo</a><div id="siteAreaButton">Area</div><nav class="desktop-nav" id="primary-nav"><a>Home</a></nav><button class="header-search">S</button><button class="menu-button">M</button></header><main>x</main><section class="more-sheet" id="more-sheet" hidden><div class="more-head"><b>Menu</b></div><div class="more-group">Links</div></section></body></html>`;
const html=extra=>`<!doctype html><html><head><title>x</title></head><body><header>${extra||""}<b>Header</b></header><main>x</main></body></html>`;
for(const rel of ["weather/index.html","transit/index.html","airport/index.html","other/index.html"])await mkdir(join(root,rel.split("/").slice(0,-1).join("/")),{recursive:true});
await writeFile(join(root,"index.html"),homeHtml());
await writeFile(join(root,"weather/index.html"),html());
await writeFile(join(root,"transit/index.html"),html());
await writeFile(join(root,"airport/index.html"),html('<select id="languageSelect"><option>VI</option><option>EN</option></select>'));
await writeFile(join(root,"other/index.html"),html());

function runInjector(){const run=spawnSync(process.execPath,["scripts/inject-static-language-switcher.mjs",root],{encoding:"utf8"});assert.equal(run.status,0,run.stderr||run.stdout)}
runInjector();
for(const [rel,slots] of [["index.html",3],["weather/index.html",1],["transit/index.html",1]]){const out=await readFile(join(root,rel),"utf8");assert.equal(out.split("data-language-slot=").length-1,slots,rel+` must have ${slots} explicit selector slot(s)`);assert.equal(out.split("/core/language-switcher.js").length-1,1,rel+" must load selector JS once");assert.equal(out.split("/core/language-switcher.css").length-1,1,rel+" must load selector CSS once")}
const home=await readFile(join(root,"index.html"),"utf8");
const primaryNav=home.match(/<nav\b[^>]*id=["']primary-nav["'][^>]*>([\s\S]*?)<\/nav>/i)?.[1]||"";
const workspace=home.match(/<div\b[^>]*class=["'][^"']*app-rail-modules[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]||"";
const mobileSheet=home.match(/<section\b[^>]*class=["'][^"']*more-sheet[^"']*["'][^>]*>([\s\S]*?)<\/section>/i)?.[1]||"";
assert.match(primaryNav,/data-language-slot="mid"/);assert.match(workspace,/data-language-slot="wide"/);assert.match(mobileSheet,/data-language-slot="mobile"/);
const airport=await readFile(join(root,"airport/index.html"),"utf8");assert.match(airport,/id="languageSelect"/);assert.doesNotMatch(airport,/data-language-slot|\/core\/language-switcher\.js/);
const other=await readFile(join(root,"other/index.html"),"utf8");assert.doesNotMatch(other,/data-language-slot|\/core\/language-switcher\.js/);
runInjector();for(const [rel,slots] of [["index.html",3],["weather/index.html",1],["transit/index.html",1]]){const out=await readFile(join(root,rel),"utf8");assert.equal(out.split("data-language-slot=").length-1,slots,rel+" injection must be idempotent")}

// Weather freshness must be derived from observed producer artifacts, not an
// invented model-release schedule. Fixture timestamps mirror the 2026-10-02
// source shape: dashboard 07:56 ICT, ECMWF spatial cycle 18Z generated 07:55 ICT.
const now=Date.parse("2026-10-02T08:10:00+07:00");
const pointHours=Array.from({length:8},(_,i)=>({time_iso:`2026-10-02T${String(9+i).padStart(2,"0")}:00:00+07:00`,wind:12+i,gust:18+i,rain:0.2,wave:0.6}));
const dashboard={generated_at:"2026-10-02T07:56:12+07:00",source_cycles:{ECMWF:"2026-10-01T18:00:00Z"},points:Object.fromEntries(Array.from({length:8},(_,i)=>[`p${i}`,{hours:pointHours}]))};
const spatial={run_time:"2026-10-01T18:00:00Z",generated_at:"2026-10-02T00:55:06Z"};
const contract=deriveForecastFreshnessContract({dashboard,spatial},{now});
assert.equal(contract.source_cycle_at,"2026-10-01T18:00:00.000Z");assert.equal(contract.latest_available_cycle_at,"2026-10-01T18:00:00.000Z");assert.equal(contract.source_cycle_matches_latest,true);assert.equal(contract.required_points,8);assert.ok(Date.parse(contract.future_coverage_until)>now);
let state=classifyForecastFreshness(contract,{now});assert.deepEqual([state.freshness,state.forecast_valid,state.reason],["FRESH",true,"LATEST_AVAILABLE_CYCLE"]);
const unchanged=structuredClone(contract);classifyForecastFreshness(contract,{now});assert.deepEqual(contract,unchanged,"freshness classification must not mutate payload");

// The exact 204-minute symptom is valid if the same model cycle remains the
// latest actually available and future coverage still exists.
const oldVerified={...contract,snapshot_generated_at:"2026-10-02T04:46:00+07:00",verified_at:"2026-10-02T04:46:00+07:00"};
state=classifyForecastFreshness(oldVerified,{now,freshVerificationMinutes:90});assert.deepEqual([state.freshness,state.forecast_valid,state.reason],["AGING",true,"LATEST_AVAILABLE_CYCLE"]);
for(let age=0;age<=720;age+=15){const verified=new Date(now-age*60000).toISOString();const s=classifyForecastFreshness({...contract,verified_at:verified,snapshot_generated_at:verified},{now,freshVerificationMinutes:90});assert.equal(s.forecast_valid,true);assert.equal(s.reason,"LATEST_AVAILABLE_CYCLE");assert.equal(s.freshness,age<=90?"FRESH":"AGING")}

// Once a genuinely newer source cycle exists, old-cycle validity gets only a
// bounded ingest grace period based on when that newer artifact was observed.
const newerCycle="2026-10-02T00:00:00Z";
for(let seenAge=0;seenAge<=300;seenAge+=15){const latestSeen=new Date(now-seenAge*60000).toISOString();const s=classifyForecastFreshness({...contract,latest_available_cycle_at:newerCycle,latest_cycle_seen_at:latestSeen},{now,cycleIngestGraceMinutes:120});assert.equal(s.forecast_valid,seenAge<=120,`new-cycle ingest grace mismatch at ${seenAge}m`);assert.equal(s.reason,seenAge<=120?"INGESTING_NEW_CYCLE":"PIPELINE_DELAY")}
state=classifyForecastFreshness({...contract,future_coverage_until:"2026-10-02T08:09:00+07:00"},{now});assert.deepEqual([state.freshness,state.forecast_valid,state.reason],["STALE",false,"COVERAGE_EXPIRED"]);
state=classifyForecastFreshness({future_coverage_until:"2026-10-03T08:00:00+07:00"},{now});assert.deepEqual([state.freshness,state.forecast_valid,state.reason],["STALE",false,"INVALID_CONTRACT"]);
const incomplete=deriveForecastFreshnessContract({dashboard:{...dashboard,points:{p0:{hours:pointHours}}},spatial},{now});assert.equal(incomplete.future_coverage_until,null,"<8 required forecast points must fail contract derivation");

const translated=[];let callback=null;let rafQueue=[];class FakeObserver{constructor(cb){callback=cb}observe(target,opts){this.target=target;this.opts=opts}disconnect(){}}
const fakeRoot={};const handle=observeDynamicIsland(fakeRoot,{translate:n=>translated.push(n),Observer:FakeObserver,raf:fn=>rafQueue.push(fn)});assert.equal(translated.length,1);const child={nodeType:1};callback([{type:"childList",addedNodes:[child]},{type:"attributes",target:child}]);assert.equal(rafQueue.length,1);rafQueue.shift()();assert.equal(translated.filter(x=>x===child).length,1);handle.disconnect();
const selectorSource=await readFile("core/language-switcher.js","utf8");assert.doesNotMatch(selectorSource,/createElement\(["']nav["']\)/);assert.doesNotMatch(selectorSource,/querySelector\(["']\.site-header/);assert.match(selectorSource,/querySelectorAll\("\[data-language-slot\]/);
const islandSource=await readFile("core/en-dynamic-islands-prototype.mjs","utf8");assert.doesNotMatch(islandSource,/document\.documentElement/);
const css=await readFile("core/language-switcher.css","utf8");const js=await readFile("core/language-switcher.js","utf8");assert.ok(Buffer.byteLength(css)+Buffer.byteLength(js)<14000,"selector prototype JS+CSS budget must stay under 14 KB uncompressed");
await rm(root,{recursive:true,force:true});
console.log("PASS prototype: responsive selector owners, Airport native exclusion, observed-cycle Weather freshness matrix, scoped EN islands");
