import assert from "node:assert/strict";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const sunset=require("../core/sunset-outlook.js");

const westPoint=(rain=0,extra={})=>({
  name:"Bờ Tây",
  today:[{t:"2026-09-29T10:00:00Z",rain}],
  nowcast:{
    status:"POINT_NUMERIC_READY",
    sampled_time:"2026-09-29T09:00:00Z",
    convective_level:"WATCH",
    ...extra
  }
});
const base=(rain=0)=>({
  generated_at:"2026-09-29T09:10:00Z",
  points:{
    duong_dong:westPoint(rain),
    cua_can:westPoint(rain),
    ganh_dau:westPoint(rain)
  },
  actual:{
    vvpq:{
      observed_at:"2026-09-29T09:00:00Z",
      visibility_m:9000,
      weather:null,
      convective_cloud:false
    },
    rain_gauges:[
      {name:"Cửa Cạn",observed_at:"2026-09-29T09:00:00Z",qc:"PASS",increment_qc:"PASS",rain_observed:false,rain_intensity_mm_h:0}
    ]
  }
});

// Morning WATCH from Himawari alone must not turn into an alarming sunset warning.
{
  const data=base(0.2);
  data.generated_at="2026-09-29T00:20:00Z";
  for(const id of ["duong_dong","cua_can","ganh_dau"]){
    data.points[id].nowcast.sampled_time="2026-09-29T00:00:00Z";
  }
  data.actual.vvpq.observed_at="2026-09-29T00:00:00Z";
  data.actual.rain_gauges[0].observed_at="2026-09-29T00:20:00Z";
  const out=sunset.assess(data,"17:56",{
    nowMs:Date.parse("2026-09-29T00:45:00Z"),
    nowMinutes:7*60+45
  });
  assert.equal(out.phase,"early");
  assert.equal(out.level,"good");
  assert.equal(out.reason,"early_favorable");
}


// Morning observed rain must not be projected ten hours forward to sunset.
{
  const data=base(0.2);
  data.generated_at="2026-09-29T00:20:00Z";
  data.actual.vvpq.observed_at="2026-09-29T00:20:00Z";
  data.actual.vvpq.weather="SHRA";
  data.actual.rain_gauges[0]={
    ...data.actual.rain_gauges[0],
    observed_at:"2026-09-29T00:20:00Z",
    rain_observed:true,
    rain_intensity_mm_h:4
  };
  for(const id of ["duong_dong","cua_can","ganh_dau"]){
    data.points[id].nowcast.sampled_time="2026-09-29T00:20:00Z";
  }
  const out=sunset.assess(data,"17:56",{
    nowMs:Date.parse("2026-09-29T00:45:00Z"),
    nowMinutes:7*60+45
  });
  assert.equal(out.phase,"early");
  assert.equal(out.level,"good");
  assert.equal(out.reason,"early_favorable");
}

// Three to six hours out, current rain still must not become a sunset warning.
{
  const data=base(0.2);
  data.generated_at="2026-09-29T07:20:00Z";
  data.actual.vvpq.observed_at="2026-09-29T07:20:00Z";
  data.actual.vvpq.weather="SHRA";
  data.actual.rain_gauges[0]={
    ...data.actual.rain_gauges[0],
    observed_at:"2026-09-29T07:20:00Z",
    rain_observed:true,
    rain_intensity_mm_h:4
  };
  for(const id of ["duong_dong","cua_can","ganh_dau"]){
    data.points[id].nowcast.sampled_time="2026-09-29T07:20:00Z";
  }
  const out=sunset.assess(data,"17:56",{
    nowMs:Date.parse("2026-09-29T07:30:00Z"),
    nowMinutes:14*60+30
  });
  assert.equal(out.phase,"afternoon");
  assert.equal(out.level,"good");
  assert.equal(out.reason,"afternoon_favorable");
}

// Refresh cadence follows source value: hourly early, 30m in afternoon, 10m near sunset.
assert.equal(sunset.refreshDelayMs(600),60*60*1000);
assert.equal(sunset.refreshDelayMs(300),30*60*1000);
assert.equal(sunset.refreshDelayMs(120),10*60*1000);
assert.equal(sunset.refreshDelayMs(0),null);

// Near sunset, a usable observed cloud track aimed at the west coast becomes a watch.
{
  const data=base(0.1);
  for(const id of ["duong_dong","cua_can","ganh_dau"]){
    data.points[id].nowcast.cloud_motion={
      status:"IMPACT_EXPECTED",public_track_usable:true,predicted_impact:true,
      approaching:true,eta_minutes:35
    };
  }
  const out=sunset.assess(data,"17:56",{
    nowMs:Date.parse("2026-09-29T09:30:00Z"),
    nowMinutes:16*60+30
  });
  assert.equal(out.level,"watch");
  assert.equal(out.reason,"cloud_approaching");
  assert.equal(out.cloud_track_impact,true);
}

// WATCH convection that is demonstrably passing by should not warn by itself.
{
  const data=base(0.1);
  for(const id of ["duong_dong","cua_can","ganh_dau"]){
    data.points[id].nowcast.cloud_motion={
      status:"PASSING_BY",public_track_usable:true,predicted_impact:false,
      approaching:false,closest_approach_km:35
    };
  }
  const out=sunset.assess(data,"17:56",{
    nowMs:Date.parse("2026-09-29T09:30:00Z"),
    nowMinutes:16*60+30
  });
  assert.equal(out.level,"good");
  assert.equal(out.reason,"cloud_passing");
}

// Poor observed visibility close to sunset is relevant even without rain.
{
  const data=base(0.1);
  data.actual.vvpq.visibility_m=3500;
  const out=sunset.assess(data,"17:56",{
    nowMs:Date.parse("2026-09-29T09:30:00Z"),
    nowMinutes:16*60+30
  });
  assert.equal(out.level,"watch");
  assert.equal(out.reason,"low_visibility");
}

console.log("sunset outlook tests passed");
