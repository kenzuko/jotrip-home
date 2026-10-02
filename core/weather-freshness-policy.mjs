const toMs=value=>{const t=Date.parse(value||"");return Number.isFinite(t)?t:0};
const minutes=(a,b)=>Math.max(0,Math.round((a-b)/60000));

export function classifyForecastFreshness(input,{now=Date.now(),cycleGraceMinutes=120,freshDisplayMinutes=90}={}){
  const generated=toMs(input?.snapshot_generated_at||input?.generated_at);
  const sourceCycle=toMs(input?.source_cycle_at);
  const expectedCycle=toMs(input?.latest_expected_cycle_at);
  const coverage=toMs(input?.future_coverage_until);
  if(!sourceCycle||!coverage)return {freshness:"STALE",forecast_valid:false,reason:"INVALID_CONTRACT"};
  if(coverage<=now)return {freshness:"STALE",forecast_valid:false,reason:"COVERAGE_EXPIRED"};

  const expectedToleranceMs=5*60000;
  const cycleIsLatest=!expectedCycle||sourceCycle>=expectedCycle-expectedToleranceMs;
  if(cycleIsLatest){
    const snapshotAge=generated?minutes(now,generated):null;
    return {
      freshness:snapshotAge!==null&&snapshotAge<=freshDisplayMinutes?"FRESH":"AGING",
      forecast_valid:true,
      reason:"LATEST_AVAILABLE_CYCLE",
      snapshot_age_minutes:snapshotAge
    };
  }

  const waitMinutes=minutes(now,expectedCycle);
  if(now<=expectedCycle+cycleGraceMinutes*60000){
    return {freshness:"AGING",forecast_valid:true,reason:"WAITING_NEW_CYCLE",wait_minutes:waitMinutes};
  }
  return {freshness:"STALE",forecast_valid:false,reason:"PIPELINE_DELAY",wait_minutes:waitMinutes};
}
