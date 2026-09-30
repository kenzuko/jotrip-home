import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {verifyWeatherRelease} from "./weather-release-guard.mjs";
const now=Date.now(),at=n=>new Date(now-n*60_000).toISOString();
const valid=(cloud=20,cycle=480,marine=100)=>({
 schema_version:"weather-runtime-manifest-v1",status:"READY",
 generated_at:at(2),policy:{frontend_source:"SAME_ORIGIN_CANONICAL_ONLY"},
 files:Object.fromEntries(["cloud","compact","current","forecast","marine","meta"]
  .map(k=>[k,"/weather/data/weather-runtime/"+k+".json"])),
 source_times:{cloud_sampled_time:at(cloud),forecast_run_time:at(cycle),
  marine_sampled_time:at(marine)}
});
const old=valid(43,680,160),next=valid();
assert.equal(verifyWeatherRelease(next,old,now).status,"VERIFIED_NO_REGRESSION");
assert.equal(verifyWeatherRelease(next,next,now).status,"VERIFIED_NO_REGRESSION");
for(const [label,make] of [
 ["old satellite",{...next,source_times:{...next.source_times,cloud_sampled_time:at(44)}}],
 ["old model",{...next,source_times:{...next.source_times,forecast_run_time:at(681)}}],
 ["old marine",{...next,source_times:{...next.source_times,marine_sampled_time:at(161)}}],
 ["stale candidate",{...next,source_times:{...next.source_times,cloud_sampled_time:at(64)}}],
 ["future model",{...next,source_times:{...next.source_times,forecast_run_time:at(-15)}}],
 ["wrong authority",{...next,policy:{frontend_source:"EXTERNAL"}}],
 ["fake READY",{...next,status:"PARTIAL"}]
])assert.throws(()=>verifyWeatherRelease(make,old,now),undefined,label);
assert.throws(()=>verifyWeatherRelease(next,null,now),/Last deployed/, "missing production state cannot be invented");
assert.throws(()=>verifyWeatherRelease(next,{...old,status:"UNAVAILABLE"},now),/Last deployed/);
const worker=readFileSync(".github/workflows/cloudflare-worker.yml","utf8");
const cms=readFileSync(".github/workflows/cms-weather-standalone.yml","utf8");
const pages=readFileSync(".github/workflows/cms-pages-publish.yml","utf8");
assert.equal((worker.match(/command: deploy --config wrangler\.jsonc/g)||[]).length,1,
 "canonical Worker must have exactly one deploy writer");
assert.equal((cms.match(/wrangler(?:@[^\s]*)? deploy --config wrangler\.jsonc/g)||[]).length,0,
 "CMS weather updater must never replace canonical Worker");
assert.match(worker,/node scripts\/weather-cms-sync\.mjs --strict/);
assert.doesNotMatch(worker,/Forecast coverage remains a strict promotion gate\. An unrelated/);
assert.match(cms,/scripts\/weather-release-guard\.mjs/);
assert.match(pages,/scripts\/weather-release-guard\.mjs/);
console.log("PASS Weather last-known-good monotonic release, one Worker writer and fail-closed CMS");
