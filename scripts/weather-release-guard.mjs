// A build is publishable only if it is fresh, complete and cannot move
// production Weather's last verified observation/model timestamps backward.
// Never construct a "last good" snapshot from old files in a fresh Git checkout.
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFile,writeFile} from "node:fs/promises";
import {pathToFileURL} from "node:url";
const FIELDS=["cloud_sampled_time","forecast_run_time","marine_sampled_time"];
const MAX_AGE={cloud_sampled_time:60,forecast_run_time:24*60,marine_sampled_time:480};
const parsed=(value)=>{
  if(typeof value!=="string"||!/(?:Z|[+-]\d\d:\d\d)$/.test(value))return null;
  const t=Date.parse(value);
  return Number.isFinite(t)?t:null;
};
export function verifyWeatherRelease(next,previous,now=Date.now()){
  assert.equal(next?.schema_version,"weather-runtime-manifest-v1","candidate has unknown manifest schema");
  assert.equal(next?.status,"READY","candidate manifest is not READY");
  assert.equal(next?.policy?.frontend_source,"SAME_ORIGIN_CANONICAL_ONLY","candidate runtime authority mismatch");
  for(const [kind,path] of Object.entries({
    cloud:"/weather/data/weather-runtime/cloud.json",
    compact:"/weather/data/weather-runtime/compact.json",
    current:"/weather/data/weather-runtime/current.json",
    forecast:"/weather/data/weather-runtime/forecast.json",
    marine:"/weather/data/weather-runtime/marine.json",
    meta:"/weather/data/weather-runtime/meta.json"
  }))assert.equal(next.files?.[kind],path,"missing canonical runtime file "+kind);
  const previousReady=previous?.status==="READY"&&previous?.schema_version==="weather-runtime-manifest-v1";
  if(!previous||!previousReady)throw Error("Last deployed Weather manifest missing or unverifiable; refuse automatic release");
  const result={status:"VERIFIED_NO_REGRESSION",source_times:{},prior_source_times:{}};
  for(const field of FIELDS){
    const incoming=parsed(next.source_times?.[field]);
    const prior=parsed(previous.source_times?.[field]);
    if(incoming===null||prior===null)throw Error(field+" timestamp missing/unverifiable");
    if(incoming>now+5*60_000)throw Error(field+" candidate timestamp lies in future");
    if(incoming<prior)throw Error(field+" would roll back deployed Weather data");
    if(now-incoming>MAX_AGE[field]*60_000)throw Error(field+" candidate is outside release freshness budget");
    result.source_times[field]=next.source_times[field];
    result.prior_source_times[field]=previous.source_times[field];
  }
  const generated=parsed(next.generated_at);
  if(generated===null||generated>now+5*60_000||now-generated>45*60_000)
    throw Error("Candidate was not built from a recent validated snapshot");
  return result;
}
export async function writeReleaseReceipt(candidateFile,previousFile,receiptFile){
  const raw=await readFile(candidateFile),next=JSON.parse(raw);
  const prior=JSON.parse(await readFile(previousFile,"utf8"));
  const result=verifyWeatherRelease(next,prior);
  const receipt={
    schema_version:"openpq-weather-release-v1",
    status:result.status,
    checked_at:new Date().toISOString(),
    source_times:result.source_times,
    prior_source_times:result.prior_source_times,
    manifest_sha256:createHash("sha256").update(raw).digest("hex")
  };
  if(receiptFile)await writeFile(receiptFile,JSON.stringify(receipt)+"\n");
  console.log("Weather release monotonicity verified",JSON.stringify(result.source_times));
  return receipt;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const [next,prior,output]=process.argv.slice(2);
  if(!next||!prior)throw Error("Usage: node weather-release-guard.mjs NEXT_MANIFEST DEPLOYED_MANIFEST [RECEIPT]");
  await writeReleaseReceipt(next,prior,output);
}
