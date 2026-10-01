import assert from "node:assert/strict";
import fs from "node:fs";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const short=require("../weather/weather-v3-public-contract.js");

const NOW=Date.parse("2026-10-01T10:00:00Z");

{
  const critical={human_weather:{rain:{an_thoi:{
    evidence:"ACTUAL",observed:true,at:"2026-10-01T09:50:00Z",
    headline:"An Thới đang có mưa rào nhẹ.",detail:"Mưa đang được ghi nhận tại điểm."
  }}}};
  const v=short.nowView(critical,"an_thoi",NOW);
  assert.equal(v.state,"ACTUAL_RAIN");
  assert.equal(v.evidenceClass,"ACTUAL");
}
{
  const v=short.nowView({},"an_thoi",NOW);
  assert.equal(v.state,"NO_DIRECT_RAIN_CONFIRMATION");
  assert.match(v.detail,/chưa nên kết luận trời đang khô/i);
}
{
  const nowcast={sampled_time:"2026-10-01T08:59:00Z",points:{an_thoi:{
    score:100,cloud_motion:{public_track_usable:true,predicted_impact:true,eta_minutes:10}
  }}};
  assert.equal(short.soonView(nowcast,"an_thoi",NOW).state,"STALE",
    "61-minute Himawari data must not drive public short-term wording");
}
{
  const nowcast={sampled_time:"2026-10-01T09:50:00Z",points:{an_thoi:{
    score:90,cloud_motion:{public_track_usable:true,predicted_impact:false,status:"PASSING_BY"}
  }}};
  const v=short.soonView(nowcast,"an_thoi",NOW);
  assert.equal(v.state,"PASSING_BY");
  assert.doesNotMatch(v.headline,/mưa đang tới/i);
}
{
  const nowcast={sampled_time:"2026-10-01T09:50:00Z",points:{an_thoi:{
    score:90,cloud_motion:{public_track_usable:true,predicted_impact:true,eta_minutes:42,status:"APPROACHING"}
  }}};
  const v=short.soonView(nowcast,"an_thoi",NOW);
  assert.equal(v.window,"30_60_MIN");
  assert.match(v.detail,/chưa phải số đo mưa tại mặt đất/i);
}

const home=fs.readFileSync("home-live-v3.js","utf8");
const homepage=fs.readFileSync("index.html","utf8");
const weather=fs.readFileSync("weather/index.html","utf8");
assert.match(home,/critical:\s*"\/weather\/data\/critical\.json"/);
assert.match(home,/nowcast:\s*"\/weather\/data\/nowcast-compact\.json"/);
assert.doesNotMatch(home,/raw\.githubusercontent\.com\/kenzuko\/Jotrip-Lab\/gh-pages\/weather\/data\/critical\.json/);
assert.match(homepage,/weather\/weather-v3-public-contract\.js/);
assert.match(weather,/id="v3ObservationPanel"/);
assert.doesNotMatch(weather,/V3 · OBSERVATION|V3 Beta|>BETA</);
assert.doesNotMatch(weather,/V2 vẫn là lớp quyết định|Nowcast chỉ xuất hiện/);

console.log("canonical Weather V3 human copy and homepage sync tests passed");
