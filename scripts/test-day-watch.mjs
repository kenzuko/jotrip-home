import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {readFileSync} from "node:fs";
const require=createRequire(import.meta.url);
const dayWatch=require("../core/day-watch.js");

const base=[
  {kind:"weather",dedupe_key:"weather-current",overlaps_sunset:true,text:"Có nơi đang mưa.",href:"weather/",priority:90,level:"watch"},
  {kind:"ongoing_operation",dedupe_key:"show-1",text:"Một show đang tạm dừng.",href:"places/",priority:100,level:"watch"},
  {kind:"marine_operation",dedupe_key:"marine",text:"Cano Nam đảo đang tạm dừng hôm nay.",href:"cano/",priority:130,level:"alert"}
];

// The surface is intentionally tiny: at most two high-value issues.
{
  const out=dayWatch.select(base,{sunsetWeather:{level:"good",reason:"early_favorable"}});
  assert.equal(out.length,2);
  assert.equal(out[0].kind,"marine_operation");
  assert.equal(out[1].kind,"ongoing_operation");
}

// Low-grade satellite watches stay elsewhere on the homepage.
{
  const out=dayWatch.select([
    {kind:"weather",text:"Mây đối lưu đang tăng.",priority:65,level:"watch"}
  ],{sunsetWeather:{level:"good",reason:"early_favorable"}});
  assert.deepEqual(out,[]);
}

// Do not repeat the same rain/weather warning immediately below sunset copy.
{
  const out=dayWatch.select([
    {kind:"weather",dedupe_key:"weather-current",overlaps_sunset:true,text:"Có nơi đang mưa.",priority:90,level:"watch"},
    {kind:"airport",dedupe_key:"airport",text:"Có chuyến bay bị hủy.",priority:120,level:"watch"}
  ],{sunsetWeather:{level:"watch",reason:"forecast_rain"}});
  assert.equal(out.length,1);
  assert.equal(out[0].kind,"airport");
}

// Morning sunset logic can be favorable while current rain remains useful now.
{
  const out=dayWatch.select([
    {kind:"weather",dedupe_key:"weather-current",overlaps_sunset:true,text:"Có nơi đang mưa.",priority:90,level:"watch"}
  ],{sunsetWeather:{level:"good",reason:"early_favorable"}});
  assert.equal(out.length,1);
  assert.equal(out[0].kind,"weather");
}

// Duplicate feeds collapse to one user-facing line.
{
  const out=dayWatch.select([
    {kind:"airport",dedupe_key:"airport",text:"Có chuyến bay bị hủy.",priority:120,level:"watch"},
    {kind:"airport",dedupe_key:"airport",text:"Sân bay có thay đổi.",priority:110,level:"watch"}
  ],{sunsetWeather:{level:"good",reason:"favorable"}});
  assert.equal(out.length,1);
  assert.match(out[0].text,/bị hủy/);
}

// Integration locks: no titled module, no future booking-full notice promoted today.
const homepage=readFileSync("index.html","utf8");
const live=readFileSync("home-live-v3.js","utf8");
assert.match(homepage,/id="tripDayWatch"/);
assert.doesNotMatch(homepage,/Operations Watch|Cần lưu ý hôm nay/);
assert.match(live,/notice\.date === todayKey/);
assert.match(live,/priority:Number\.isFinite\(ageDays\)&&ageDays<=7\?100:85/);
assert.match(live,/validUntilDay >= todayKey/);
assert.match(live,/dayWatchRainGauges\.length >= 2/);
assert.match(live,/day_watch_candidates: dayWatchCandidates/);

console.log("day-watch tests passed");
