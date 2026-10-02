const toMs=value=>{const t=Date.parse(value||"");return Number.isFinite(t)?t:0};
const iso=value=>{const t=toMs(value);return t?new Date(t).toISOString():null};
const minutes=(a,b)=>Math.max(0,Math.round((a-b)/60000));
const numeric=value=>typeof value==="number"&&Number.isFinite(value);

function validForecastRow(row){
  return Boolean(row&&toMs(row.time_iso)&&numeric(row.wind)&&numeric(row.gust)&&numeric(row.rain)&&numeric(row.wave));
}

export function deriveForecastFreshnessContract({dashboard,spatial}={}, {now=Date.now(),minPoints=8}={}){
  const sourceCycle=dashboard?.source_cycles?.ECMWF||null;
  const latestAvailable=spatial?.run_time||null;
  const latestSeen=spatial?.generated_at||null;
  const pointRows=Object.values(dashboard?.points||{});
  let futureCoverageUntil=null;
  if(pointRows.length>=minPoints){
    const perPointLast=pointRows.map(point=>{
      const times=(point?.hours||[]).filter(validForecastRow).map(row=>toMs(row.time_iso)).filter(t=>t>now);
      return times.length?Math.max(...times):0;
    });
    if(perPointLast.every(Boolean))futureCoverageUntil=new Date(Math.min(...perPointLast)).toISOString();
  }
  return {
    snapshot_generated_at:dashboard?.source_snapshot_generated_at||dashboard?.generated_at||null,
    verified_at:dashboard?.generated_at||null,
    source_cycle_at:iso(sourceCycle),
    latest_available_cycle_at:iso(latestAvailable),
    latest_cycle_seen_at:iso(latestSeen),
    future_coverage_until:futureCoverageUntil,
    source_cycle_matches_latest:Boolean(toMs(sourceCycle)&&toMs(latestAvailable)&&Math.abs(toMs(sourceCycle)-toMs(latestAvailable))<=5*60000),
    required_points:pointRows.length
  };
}

export function classifyForecastFreshness(input,{now=Date.now(),cycleIngestGraceMinutes=120,freshVerificationMinutes=90}={}){
  const sourceCycle=toMs(input?.source_cycle_at);
  const latestAvailable=toMs(input?.latest_available_cycle_at);
  const latestSeen=toMs(input?.latest_cycle_seen_at);
  const coverage=toMs(input?.future_coverage_until);
  const verified=toMs(input?.verified_at||input?.generated_at);
  const snapshot=toMs(input?.snapshot_generated_at);
  if(!sourceCycle||!latestAvailable||!coverage)return {freshness:"STALE",forecast_valid:false,reason:"INVALID_CONTRACT"};
  if(coverage<=now)return {freshness:"STALE",forecast_valid:false,reason:"COVERAGE_EXPIRED"};

  const tolerance=5*60000;
  if(sourceCycle>=latestAvailable-tolerance){
    const verifiedAge=verified?minutes(now,verified):null;
    const snapshotAge=snapshot?minutes(now,snapshot):null;
    return {
      freshness:verifiedAge!==null&&verifiedAge<=freshVerificationMinutes?"FRESH":"AGING",
      forecast_valid:true,
      reason:"LATEST_AVAILABLE_CYCLE",
      verified_age_minutes:verifiedAge,
      snapshot_age_minutes:snapshotAge
    };
  }

  // A newer cycle is already observable at the source. Keep the previous cycle
  // only for a bounded ingest grace window, and only while it still has future
  // coverage. This distinguishes publication lag from model validity.
  if(latestSeen){
    const seenAge=minutes(now,latestSeen);
    if(now<=latestSeen+cycleIngestGraceMinutes*60000){
      return {freshness:"AGING",forecast_valid:true,reason:"INGESTING_NEW_CYCLE",latest_cycle_seen_age_minutes:seenAge};
    }
    return {freshness:"STALE",forecast_valid:false,reason:"PIPELINE_DELAY",latest_cycle_seen_age_minutes:seenAge};
  }
  return {freshness:"STALE",forecast_valid:false,reason:"NEWER_CYCLE_UNVERIFIED"};
}
