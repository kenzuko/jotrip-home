// OpenPQ-owned Weather alert audit. Never fetches the disposable Lab website.
// Shared source/gust/ledger guards are imported for both Worker and Pages.
import "../../weather/weather-wind-guard.js";
import "../../weather/weather-gust-outlook.js";
import "./weather-alert-ledger.js";
import {handleWeatherData} from "./weather-edge.js";

const origin="https://openphuquoc-v3.kenzuko.workers.dev";
const names={
  critical:"/weather/data/critical.json",
  dashboard:"/weather/data/dashboard-data.json",
  local:"/weather/data/local-now.json",
  nowcast:"/weather/data/nowcast-compact.json",
  ground:"/weather/data/groundtruth.json"
};
const n=x=>typeof x==="number"&&Number.isFinite(x)?x:null;
const stamp=x=>{const t=Date.parse(x||"");return Number.isFinite(t)?t:null};
const age=(x,now)=>stamp(x)===null?Infinity:(now-stamp(x))/60000;
function json(data,status=200){
  return new Response(JSON.stringify(data),{
    status,headers:{"content-type":"application/json; charset=utf-8",
      "cache-control":"no-store",
      "x-jotrip-weather-audit":"d1-v1"}
  });
}
async function readSource(path,env){
  const url=new URL(path,origin);
  const req=new Request(url.toString(),{headers:{accept:"application/json"}});
  const response=await handleWeatherData(req,()=>env.ASSETS.fetch(req));
  if(!response.ok)throw Error(path+" HTTP "+response.status);
  const body=await response.json();
  if(!body||typeof body!=="object"||body.schema_version==="UNAVAILABLE")
    throw Error(path+" returned no validated JSON");
  return body;
}
function mergeFreshLocal(base,local,now){
  const copy=structuredClone(base);
  const old=stamp(copy.local_generated_at);
  const incoming=stamp(local?.generated_at);
  if(!local?.points||incoming===null||incoming>now+600000||
      now-incoming>50*60000||(old!==null&&incoming<old))return copy;
  for(const [id,p] of Object.entries(local.points)){
    if(!copy.points?.[id])continue;
    copy.points[id].local={...copy.points[id].local,...p};
  }
  copy.local_generated_at=local.generated_at;
  return copy;
}
async function priorStates(db,now){
  const cutoff=new Date(now-3*86400000).toISOString();
  const result=await db.prepare(
    "SELECT alert_id, point_id, type, status, severity, signature, latest_json,"+
    " first_seen_at, last_seen_at, updated_at, valid_until "+
    "FROM weather_alert_state WHERE updated_at>=? ORDER BY updated_at DESC LIMIT 300"
  ).bind(cutoff).all();
  return result.results||[];
}
function statements(db,plan,forecast,ground,now){
  const sql=[];
  if(forecast){
    sql.push(db.prepare(
      "INSERT OR IGNORE INTO weather_forecast_snapshots"+
      " (snapshot_id,captured_at,generated_at,source_cycles_json,payload_json) VALUES (?,?,?,?,?)"
    ).bind(forecast.snapshot_id,forecast.captured_at,forecast.generated_at,
      JSON.stringify(forecast.source_cycles),JSON.stringify(forecast)));
  }
  for(const state of plan.states){
    sql.push(db.prepare(
      "INSERT INTO weather_alert_state"+
      " (alert_id,point_id,type,status,severity,signature,latest_json,first_seen_at,last_seen_at,updated_at,valid_until)"+
      " VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(alert_id) DO UPDATE SET "+
      "status=excluded.status,severity=excluded.severity,signature=excluded.signature,"+
      "latest_json=excluded.latest_json,last_seen_at=excluded.last_seen_at,"+
      "updated_at=excluded.updated_at,valid_until=excluded.valid_until"
    ).bind(state.alert_id,state.point_id,state.type,state.status,state.severity,
      state.signature,state.latest_json,state.first_seen_at,state.last_seen_at,
      state.updated_at,state.valid_until));
  }
  for(const change of plan.transitions){
    sql.push(db.prepare(
      "INSERT OR IGNORE INTO weather_alert_transitions"+
      " (event_id,alert_id,changed_at,previous_status,new_status,kind,payload_json)"+
      " VALUES(?,?,?,?,?,?,?)"
    ).bind(change.event_id,change.alert_id,change.changed_at,
      change.previous_status,change.new_status,change.kind,JSON.stringify(change.alert)));
  }
  const v=ground?.atmosphere?.vvpq||{};
  const t=stamp(v.observed_at);
  if(v.qc==="PASS"&&v.source_channel==="METAR"&&t!==null&&now-t<120*60000&&now-t>=-600000){
    const actual=globalThis.JoTripGustOutlook.metarGust(ground,now);
    sql.push(db.prepare(
      "INSERT OR IGNORE INTO weather_station_observations"+
      " (station_id,observed_at,wind_kmh,gust_kmh,latitude,longitude,source_class)"+
      " VALUES(?,?,?,?,?,?,?)"
    ).bind(v.station_id||"VVPQ",v.observed_at,n(v.wind_speed_kmh),
      actual?.gust_kmh??null,n(v.lat),n(v.lon),"ACTUAL_METAR"));
  }
  for(const v of Object.values(ground?.rainfall?.stations||{})){
    const t=stamp(v.observed_at);
    if(v.qc!=="PASS"||t===null||now-t>120*60000||now-t< -600000)continue;
    sql.push(db.prepare(
      "INSERT OR IGNORE INTO weather_rain_observations"+
      " (station_id,observed_at,period_start,accumulation_mm,increment_mm)"+
      " VALUES(?,?,?,?,?)"
    ).bind(v.station_id||v.station_name,v.observed_at,
      v.period_start||ground.rainfall?.period_start||null,
      n(v.accumulation_mm),n(v.increment_mm)));
  }
  return sql;
}
export async function captureWeatherAlerts(env,clock=Date.now()){
  if(!env?.CMS_DB?.prepare)return {status:"HISTORY_UNAVAILABLE",reason:"D1_NOT_BOUND"};
  const db=env.CMS_DB;
  const [criticalRes,dashboardRes,localRes,nowcastRes,groundRes]=await Promise.allSettled([
    readSource(names.critical,env),readSource(names.dashboard,env),
    readSource(names.local,env),readSource(names.nowcast,env),
    readSource(names.ground,env)
  ]);
  if(criticalRes.status!=="fulfilled"||dashboardRes.status!=="fulfilled")
    throw Error("Missing primary Weather source - preserving prior alert states");
  const critical=criticalRes.value,dashboard=dashboardRes.value;
  if(!critical.points||!dashboard.points||!dashboard.generated_at)
    throw Error("Invalid primary Weather source - preserving prior state");
  const local=localRes.status==="fulfilled"?localRes.value:null;
  const nowcast=nowcastRes.status==="fulfilled"?nowcastRes.value:null;
  const ground=groundRes.status==="fulfilled"?groundRes.value:null;
  const live=mergeFreshLocal(critical,local,clock);
  const publication=globalThis.JoTripGustOutlook.islandAlerts({
    critical:live,dashboard,nowcast,groundtruth:ground,now:clock
  });
  const previous=await priorStates(db,clock);
  const plan=globalThis.JoTripAlertLedger.nextState(previous,publication,clock);
  const modelReady=globalThis.JoTripWindGuard.dashboardUsable(dashboard,clock);
  const snap=modelReady?globalThis.JoTripAlertLedger.snapshot(dashboard,clock):null;
  const sql=statements(db,plan,snap,ground,clock);
  // D1 executes an atomic batch; a failed ingest must not erase old warnings.
  if(sql.length)await db.batch(sql);
  const result={schema_version:"openpq-weather-alert-capture-v1",
    status:nowcast?"READY":"DEGRADED",captured_at:new Date(clock).toISOString(),
    model_ready:modelReady,source_status:{critical:"READY",dashboard:"READY",
      local:local&&age(local.generated_at,clock)<=35?"READY":"STALE_OR_MISSING",
      satellite:nowcast&&age(nowcast.sampled_time,clock)<=25?"READY":"STALE_OR_MISSING",
      ground:ground&&age(ground.generated_at,clock)<=60?"READY":"STALE_OR_MISSING"},
    active:publication.alerts.length,transitions:plan.transitions.length,
    snapshot_saved:Boolean(snap)};
  console.log("Weather alert capture",JSON.stringify(result));
  return result;
}
export async function readWeatherAlertHistory(env){
  const db=env?.CMS_DB;
  if(!db?.prepare)return json({schema_version:"openpq-alert-history-v1",
    status:"HISTORY_UNAVAILABLE",alerts:[],events:[]},503);
  try{
    const [active,history]=await Promise.all([
      db.prepare("SELECT alert_id,point_id,type,status,severity,latest_json,updated_at,valid_until "+
        "FROM weather_alert_state ORDER BY updated_at DESC LIMIT 40").all(),
      db.prepare("SELECT event_id,alert_id,changed_at,previous_status,new_status,kind,payload_json "+
        "FROM weather_alert_transitions ORDER BY changed_at DESC LIMIT 80").all()
    ]);
    return json({schema_version:"openpq-alert-history-v1",status:"READY",
      checked_at:new Date().toISOString(),
      alerts:(active.results||[]).map(r=>({
        alert_id:r.alert_id,point_id:r.point_id,type:r.type,
        status:r.status,severity:r.severity,updated_at:r.updated_at,
        valid_until:r.valid_until,alert:JSON.parse(r.latest_json)
      })),
      events:(history.results||[]).map(r=>({
        event_id:r.event_id,alert_id:r.alert_id,changed_at:r.changed_at,
        previous_status:r.previous_status,new_status:r.new_status,
        kind:r.kind,alert:JSON.parse(r.payload_json)
      }))
    });
  }catch(error){
    console.warn("Weather alert history D1 read failed",error.message);
    return json({schema_version:"openpq-alert-history-v1",
      status:"HISTORY_UNAVAILABLE",alerts:[],events:[]},503);
  }
}
