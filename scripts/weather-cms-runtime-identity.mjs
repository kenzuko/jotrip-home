// Verify one generated CMS Weather release uses the source timestamps of its
// own enclosed assets. This is not a freshness check and does not alter data.
// Run in addition to the independent last-deployed monotonic release guard.
const timestamp=(s,label)=>{
  if(typeof s!=="string"||!/(?:Z|[+-]\\d\\d:\\d\\d)$/.test(s))throw Error(label+" must include an explicit timezone");
  const n=Date.parse(s);
  if(!Number.isFinite(n))throw Error(label+" is not a valid instant");
  return n;
};
function sameTime(a,b,label){
  if(timestamp(a,label+" manifest")!==timestamp(b,label+" asset"))
    throw Error(label+" manifest and packaged asset refer to different observations or model runs");
}
export function verifyCMSWeatherRuntimeIdentity({manifest,cloud,compact,forecast,marine,meta}){
  if(manifest?.schema_version!=="weather-runtime-manifest-v1"||manifest.status!=="READY")
    throw Error("CMS Weather runtime identity: manifest invalid");
  if(manifest.policy?.frontend_source!=="SAME_ORIGIN_CANONICAL_ONLY")
    throw Error("CMS Weather runtime identity: canonical source authority missing");
  if(!cloud?.spatial?.frames?.length||!forecast?.spatial?.frames?.length||!marine?.wave?.cells?.length)
    throw Error("CMS Weather runtime identity: mandatory asset missing");
  sameTime(manifest.source_times?.cloud_sampled_time,cloud.sampled_time,"Himawari");
  sameTime(manifest.source_times?.forecast_run_time,forecast.run_time,"ECMWF");
  sameTime(manifest.source_times?.marine_sampled_time,marine.wave.sampled_time,"marine");
  // Compact can legitimately be newer than the full cloud frame but not older.
  if(timestamp(compact?.sampled_time,"satellite compact")<
     timestamp(cloud.sampled_time,"satellite cloud"))
    throw Error("CMS Weather runtime identity: compact observation older than published full cloud");
  // A fresh dashboard with older spatial source is a mixed-model release, not
  // an internally consistent model READY package.
  if(meta?.source_cycles?.ECMWF){
    sameTime(meta.source_cycles.ECMWF,forecast.run_time,"ECMWF dashboard/spatial");
  }
  return {status:"PACKAGED_RUNTIME_COHERENT",
    cloud_sampled_time:cloud.sampled_time,
    forecast_run_time:forecast.run_time,
    marine_sampled_time:marine.wave.sampled_time};
}
