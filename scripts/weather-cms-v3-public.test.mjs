import assert from "node:assert/strict";
import fs from "node:fs";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const short=require("../weather/weather-v3-public-contract.js");
const NOW=Date.parse("2026-10-01T11:30:00Z");

{
  const critical={human_weather:{rain:{an_thoi:{evidence:"ACTUAL",observed:true,at:"2026-10-01T11:20:00Z",headline:"An Thới đang có mưa rào nhẹ.",detail:"Mưa đang được ghi nhận tại điểm."}}}};
  const v=short.nowView(critical,"an_thoi",NOW);
  assert.equal(v.state,"ACTUAL_RAIN");assert.equal(v.evidenceClass,"ACTUAL");assert.equal(v.scope,"POINT");
}
{
  const critical={human_weather:{rain:{an_thoi:{evidence:"ACTUAL",observed:true,at:"2026-10-01T10:00:00Z",headline:"Mưa cũ",detail:"cũ"}}}};
  const v=short.nowView(critical,"an_thoi",NOW);
  assert.equal(v.state,"NO_DIRECT_RAIN_CONFIRMATION");assert.match(v.detail,/chưa nên kết luận trời đang khô/i);
}
{
  const critical={actual:{vvpq:{status:"FRESH",observed_at:"2026-10-01T11:15:00Z",weather:"-TSRA"}}};
  const v=short.nowView(critical,"ganh_dau",NOW);
  assert.equal(v.evidenceClass,"ACTUAL_REFERENCE");assert.equal(v.state,"REFERENCE_ACTUAL_THUNDER_RAIN");
  assert.match(v.headline,/sân bay/i);assert.match(v.detail,/không phải xác nhận mưa tại điểm/i);
}
{
  const critical={actual:{vvpq:{status:"FRESH",observed_at:"2026-10-01T11:15:00Z",weather:"TS"}}};
  const v=short.nowView(critical,"duong_dong",NOW);
  assert.equal(v.state,"REFERENCE_ACTUAL_THUNDER");assert.doesNotMatch(v.headline,/mưa dông/i);
}
{
  const nowcast={sampled_time:"2026-10-01T11:20:00Z",points:{an_thoi:{score:95,cloud_motion:{public_track_usable:true,predicted_impact:true,eta_minutes:0,approaching:false,status:"PASSING_BY"}}}};
  const v=short.soonView(nowcast,"an_thoi",NOW);
  assert.equal(v.state,"PASSING_BY");assert.doesNotMatch(v.headline,/tiến gần/i);
}
{
  const nowcast={sampled_time:"2026-10-01T11:20:00Z",points:{rach_gia:{score:95,cloud_motion:{public_track_usable:true,predicted_impact:true,eta_minutes:0,approaching:false,status:"NEARBY"}}}};
  const v=short.soonView(nowcast,"rach_gia",NOW);
  assert.equal(v.state,"NEARBY_CONVECTION");assert.doesNotMatch(v.headline,/tiến gần/i);
}
{
  const nowcast={sampled_time:"2026-10-01T11:20:00Z",points:{duong_dong:{score:100,cloud_motion:{public_track_usable:true,predicted_impact:false,approaching:false,status:"MOVING_AWAY"}}}};
  assert.equal(short.soonView(nowcast,"duong_dong",NOW).state,"MOVING_AWAY");
}
{
  const nowcast={sampled_time:"2026-10-01T11:20:00Z",points:{ham_ninh:{score:90,cloud_motion:{public_track_usable:true,predicted_impact:true,eta_minutes:42,approaching:true,status:"IMPACT_EXPECTED"}}}};
  const v=short.soonView(nowcast,"ham_ninh",NOW);
  assert.equal(v.window,"30_60_MIN");assert.match(v.detail,/chưa phải số đo mưa tại mặt đất/i);
}
{
  const nowcast={sampled_time:"2026-10-01T10:29:00Z",points:{an_thoi:{score:100,cloud_motion:{public_track_usable:true,predicted_impact:true,eta_minutes:10,approaching:true,status:"IMPACT_EXPECTED"}}}};
  assert.equal(short.soonView(nowcast,"an_thoi",NOW).state,"STALE","61-minute Himawari data must not drive public wording");
}
{
  const nowcast={sampled_time:"2026-10-01T11:20:00Z",points:{an_thoi:{score:100,cloud_motion:{public_track_usable:false,predicted_impact:false,status:"TRACK_UNCERTAIN"}}}};
  const v=short.soonView(nowcast,"an_thoi",NOW);
  assert.equal(v.state,"CONVECTIVE_WATCH");assert.equal(v.evidenceClass,"REMOTE_OBSERVED");assert.match(v.detail,/chưa đủ để kết luận mưa sẽ tới/i);
}
{
  const out=short.pointView({},{},"duong_dong",NOW);
  assert.equal(out.policy.v2DecisionAuthority,true);
  assert.equal(out.policy.pointEstimateNeverActual,true);
  assert.equal(out.policy.referenceStationNeverEqualsPoint,true);
  assert.equal(out.policy.radarNegativeNeverMeansDry,true);
  assert.equal(out.policy.preciseEtaDisabled,true);
  assert.equal(out.policy.lightningPublicDisabled,true);
}
const home=fs.readFileSync("home-live-v3.js","utf8");
const homepage=fs.readFileSync("index.html","utf8");
const weather=fs.readFileSync("weather/index.html","utf8");
const client=fs.readFileSync("weather/weather-v3-public.js","utf8");
assert.match(home,/critical:\s*"\/weather\/data\/critical\.json"/);
assert.match(home,/nowcast:\s*"\/weather\/data\/nowcast-compact\.json"/);
assert.doesNotMatch(home,/raw\.githubusercontent\.com\/kenzuko\/Jotrip-Lab\/gh-pages\/weather\/data\/critical\.json/);
assert.match(home,/local\.temperature_class === "ESTIMATED_NOW"/);
assert.match(home,/localAge <= 45/);
assert.match(home,/freshnessText\(localStamp, "Ước tính"\)/);
assert.ok(home.indexOf('local.temperature_c') < home.indexOf('humanWeather?.temperatureC ?? vvpq?.temperature_c'),
  "Homepage Weather must prefer the current point estimate before falling back to periodic VVPQ");
assert.match(homepage,/weather\/weather-v3-public-contract\.js/);
assert.match(weather,/id="v3ObservationPanel"/);
assert.match(weather,/class="weather-version-badge"[^>]*>V3</);
assert.match(weather,/THỜI TIẾT V3/);
assert.match(weather,/THAM CHIẾU SÂN BAY/);
assert.match(weather,/METAR\/SPECI ĐỊNH KỲ/);
assert.doesNotMatch(weather,/CẢM NHẬN NGOÀI TRỜI/);
const weatherHuman=fs.readFileSync("weather/weather-human-contract.js","utf8");
assert.doesNotMatch(weatherHuman,/Chỉ số cảm giác nóng/);
const connection=fs.readFileSync("weather/weather-connection.js","utf8");
assert.match(connection,/currentWaiting&&groundWaiting/);
assert.doesNotMatch(connection,/mô hình sóng nền.*parts\.push/);
assert.match(client,/const CRITICAL="\/weather\/data\/critical\.json"/);
assert.match(client,/const NOWCAST="\/weather\/data\/nowcast-compact\.json"/);
assert.doesNotMatch(client,/raw\.githubusercontent\.com|kenzuko\.github\.io/);
assert.ok(weather.indexOf("weather-v2.js")<weather.indexOf("weather-v3-public.js"),"V2 must load before additive V3");
assert.doesNotMatch(weather,/V3 · OBSERVATION|V3 Beta|>BETA</);
assert.doesNotMatch(weather,/V2 vẫn là lớp quyết định|Nowcast chỉ xuất hiện/);
console.log("canonical Weather V3 contract and integration tests passed");