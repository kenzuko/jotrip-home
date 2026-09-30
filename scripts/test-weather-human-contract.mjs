import assert from "node:assert/strict";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const human=require("../core/weather-human-contract.js");

const critical={human_weather:{
  reference:{status:"ACTUAL",at:"2026-09-30T03:00:00Z",scope:"REFERENCE_STATION_ACTUAL",
    location:"Sân bay Phú Quốc",actual:{temperature_c:31},
    derived:{humidity_pct:79.3,feels_like_c:40.6,label:"Nóng và rất oi"}},
  rain:{an_thoi:{evidence:"ACTUAL",at:"2026-09-30T02:50:00Z",observed:true,
    derived_rate_mm_h:1.8,headline:"An Thới đang có mưa rào nhẹ.",
    detail:"Dự kiến mưa sẽ giảm trong khoảng 30-45 phút.",duration_min:[30,45]}}
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
  dry.human_weather.rain={};
  const v=human.homepage(dry);
  assert.equal(v.secondary,"Đo thực tế tại Sân bay Phú Quốc · Nóng và rất oi · cảm giác khoảng 41°");
}
{
  const stale=structuredClone(critical);
  stale.human_weather.reference.status="LAST_OBSERVED";
  assert.equal(human.homepage(stale),null);
}
{
  const estimateOnly={human_weather:{reference:{status:"UNAVAILABLE"},rain:{
    an_thoi:{evidence:"DERIVED",estimated_rate_mm_h:2.2,
      headline:"An Thới có tín hiệu mưa nhẹ."}
  }}};
  assert.equal(human.homepage(estimateOnly),null);
}
console.log("weather human contract tests passed");
