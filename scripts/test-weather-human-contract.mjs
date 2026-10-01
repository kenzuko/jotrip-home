import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {readFileSync} from "node:fs";
const require=createRequire(import.meta.url);
const human=require("../core/weather-human-contract.js");

const critical={human_weather:{
  reference:{status:"ACTUAL",at:"2026-09-30T03:00:00Z",scope:"REFERENCE_STATION_ACTUAL",
    location:"Sân bay Phú Quốc",actual:{temperature_c:31},
    derived:{humidity_pct:79.3,feels_like_c:40.6,comfort_code:"hot_very_humid",
      reason_codes:["humidity_hotter","weak_wind"],label:"Nóng và rất oi",
      reason:"Độ ẩm cao làm cơ thể cảm thấy nóng hơn nhiệt độ đo được. Gió yếu nên cảm giác oi rõ hơn."}},
  rain:{an_thoi:{evidence:"ACTUAL",at:"2026-09-30T02:50:00Z",observed:true,
    derived_rate_mm_h:1.8,intensity_code:"light_shower",headline:"An Thới đang có mưa rào nhẹ.",
    detail:"Dự kiến mưa sẽ giảm trong khoảng 30-45 phút.",duration_min:[30,45]}}
}};

function i18n(locale){
  const ui=JSON.parse(readFileSync(new URL("../data/i18n/"+locale+"/ui.json",import.meta.url),"utf8"));
  const get=path=>String(path||"").split(".").reduce((o,k)=>o?.[k],ui);
  return {
    format(path,vars={},fallback=""){
      const value=get(path);
      const template=typeof value==="string"?value:fallback;
      return String(template||"").replace(/\{([A-Za-z0-9_]+)\}/g,(_,key)=>
        Object.prototype.hasOwnProperty.call(vars,key)?String(vars[key]):"{"+key+"}");
    }
  };
}

{
  const v=human.homepage(critical);
  assert.equal(v.primary,"31°");
  assert.equal(v.secondary,"Đo thực tế · An Thới đang có mưa rào nhẹ");
  assert.equal(v.evidenceClass,"ACTUAL");
  assert.equal(v.rain.detail,"Dự kiến mưa sẽ giảm trong khoảng 30-45 phút");
  assert.equal(v.comfortLabel,"Nóng và rất oi");
  assert.match(v.comfortReason,/Độ ẩm cao/);
  assert.equal(JSON.stringify(v).includes("source"),false);
}
{
  const dry=structuredClone(critical);
  dry.human_weather.rain={};
  const v=human.homepage(dry);
  assert.equal(v.secondary,"Đo thực tế tại Sân bay Phú Quốc");\n  assert.equal(v.observationMode,"PERIODIC_METAR_SPECI");\n  assert.equal(v.comfortScope,"REFERENCE_STATION_ONLY");
  assert.equal(v.heatIndexText,"Chỉ số cảm giác nóng: khoảng 41°C");
  assert.equal(v.heatIndexMethod,"Tính từ nhiệt độ 31°C và độ ẩm khoảng 79%.");
}
{
  const en=human.homepage(critical,{i18n:i18n("en")});
  assert.equal(en.secondary,"Live observation · An Thoi is seeing light showers");
  assert.equal(en.rain.detail,"Rain is expected to ease in about 30-45 minutes");
  assert.equal(en.comfortLabel,"Hot and very humid");
  assert.match(en.comfortReason,/High humidity/);
}
{
  const ko=human.homepage(critical,{i18n:i18n("ko")});
  assert.equal(ko.secondary,"실측 · An Thoi에 약한 소나기가 내리고 있습니다");
  assert.equal(ko.rain.detail,"비는 약 30-45분 안에 약해질 것으로 예상됩니다");
  assert.equal(ko.comfortLabel,"덥고 매우 후텁지근함");
}
{
  const ru=human.homepage(critical,{i18n:i18n("ru")});
  assert.equal(ru.secondary,"Фактическое наблюдение · В An Thoi сейчас идёт небольшой кратковременный дождь");
  assert.equal(ru.rain.detail,"Ожидается, что дождь ослабеет примерно через 30-45 минут");
  assert.equal(ru.comfortLabel,"Жарко и очень душно");
}
{
  const zh=human.homepage(critical,{i18n:i18n("zh-Hans")});
  assert.equal(zh.secondary,"实测 · An Thoi目前有小阵雨");
  assert.equal(zh.rain.detail,"预计雨势将在约 30-45 分钟内减弱");
  assert.equal(zh.comfortLabel,"炎热且非常闷热");
}
{
  const dry=structuredClone(critical);
  dry.human_weather.rain={};
  const en=human.homepage(dry,{i18n:i18n("en")});
  assert.equal(en.secondary,"Observed at Phu Quoc Airport");
  assert.equal(en.heatIndexText,"Heat index: around 41°C");
  assert.equal(en.heatIndexMethod,"Calculated from an air temperature of 31°C and about 79% humidity.");
}
{
  const dry=structuredClone(critical);
  dry.human_weather.rain={};
  const ko=human.homepage(dry,{i18n:i18n("ko")});
  assert.equal(ko.secondary,"푸꾸옥 공항 실측");
  assert.equal(ko.heatIndexText,"열지수: 약 41°C");
}
{
  const dry=structuredClone(critical);
  dry.human_weather.rain={};
  const ru=human.homepage(dry,{i18n:i18n("ru")});
  assert.equal(ru.secondary,"Наблюдение: Аэропорт Фукуок");
  assert.equal(ru.heatIndexText,"Тепловой индекс: около 41°C");
}
{
  const dry=structuredClone(critical);
  dry.human_weather.rain={};
  const zh=human.homepage(dry,{i18n:i18n("zh-Hans")});
  assert.equal(zh.secondary,"富国机场 实测");
  assert.equal(zh.heatIndexText,"热指数：约 41°C");
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

// Missing actuals must never become a zero-degree airport observation.
for(const missing of [null,undefined,"","  ",false]){
  const bad=structuredClone(critical);
  bad.human_weather.reference.actual.temperature_c=missing;
  assert.equal(human.homepage(bad),null,"missing temperature must hide the actual card");
}
{
  const noDerived=structuredClone(critical);
  noDerived.human_weather.rain={};
  noDerived.human_weather.reference.derived.feels_like_c=null;
  noDerived.human_weather.reference.derived.humidity_pct=null;
  const v=human.homepage(noDerived);
  assert.equal(v.feelsLikeC,null);
  assert.equal(v.humidityPct,null);
  assert.equal(v.heatIndexText,null);
  assert.equal(v.heatIndexMethod,null);
}
{
  const missingRate=structuredClone(critical);
  missingRate.human_weather.rain.an_thoi.derived_rate_mm_h=null;
  missingRate.human_weather.rain.an_thoi.intensity_code="light_shower";
  const v=human.homepage(missingRate);
  assert.equal(v.rain.derived_rate_mm_h,null);
}
console.log("weather human contract tests passed");
