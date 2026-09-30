import assert from "node:assert/strict";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const human=require("../core/weather-human-contract.js");

const critical={human_weather:{
  island:{observation_status:"ACTUAL",observed_at:"2026-09-30T03:00:00Z",
    reference_location_name:"Sân bay Phú Quốc",
    actual:{temperature_c:31,dewpoint_c:27,wind_kmh:4,data_class:"ACTUAL"},
    derived:{humidity_percent:79.3,feels_like_c:40.6,comfort_label:"Nóng và rất oi",data_class:"DERIVED_FROM_ACTUAL"}},
  points:{an_thoi:{rain:{actual:{observation_status:"ACTUAL",rain_observed:true}},
    interpretation:{headline:"An Thới đang có mưa rào nhẹ.",
      detail:"Dự kiến mưa sẽ giảm trong khoảng 30-45 phút.",evidence_class:"ACTUAL"}}}
}};
{
  const v=human.homepage(critical);
  assert.equal(v.primary,"31°");
  assert.equal(v.secondary,"Đo thực tế · An Thới đang có mưa rào nhẹ");
  assert.equal(v.evidenceClass,"ACTUAL");
  assert.equal(v.rain.detail,"Dự kiến mưa sẽ giảm trong khoảng 30-45 phút");
  assert.equal(JSON.stringify(v).includes("source"),false);
}
{
  const dry=structuredClone(critical);
  dry.human_weather.points={};
  const v=human.homepage(dry);
  assert.equal(v.secondary,"Đo thực tế tại Sân bay Phú Quốc · Nóng và rất oi · cảm giác khoảng 41°");
}
{
  const stale=structuredClone(critical);
  stale.human_weather.island.observation_status="LAST_OBSERVED";
  stale.human_weather.island.actual.data_class="ACTUAL_STALE";
  assert.equal(human.homepage(stale),null);
}
{
  const estimateOnly={human_weather:{island:{observation_status:"UNAVAILABLE"},points:{
    an_thoi:{rain:{actual:null,estimate:{rate_mm_h:2.2,data_class:"ESTIMATED_NOW"}},
      interpretation:{headline:"An Thới có tín hiệu mưa rào nhẹ.",evidence_class:"DERIVED"}}
  }}};
  assert.equal(human.homepage(estimateOnly),null);
}
console.log("weather human contract tests passed");
