import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
const src=readFileSync(process.argv[2]||"weather/weather-v2.js","utf8");
const start=src.indexOf("function todayUiState("),end=src.indexOf("\nfunction todayWeatherIcon(",start);
assert(start>=0&&end>start,"Cannot locate real todayUiState");
const code=src.slice(start,end);
const ctx={num:x=>typeof x==="number"&&Number.isFinite(x)?x:null,
  fmt:(x,n)=>x.toFixed(n),safeModelGust:r=>r&&Number.isFinite(r.wind)&&Number.isFinite(r.gust)&&r.wind>=0&&r.gust>=r.wind?r.gust:null,
  todayLiveOverride:()=>null,Date,globalThis:{}};
vm.runInNewContext(code,ctx);
const row=(rain,wind,gust,wave,offshore=true)=>({rain,wind,gust,wave,time_iso:"2026-09-24T16:00:00+07:00",wave_reference:offshore?{status:"PASS"}:{status:"UNVERIFIED"}});
const check=(name,input,expected,fragment="")=>{const x=ctx.todayUiState(input,1);assert.equal(x.cls,expected,name);if(fragment)assert(x.reason?.includes(fragment),name+" explanation missing");console.log("PASS "+name+" -> "+x.cls);};
check("screenshot 16h: rain 7.6 gust 37 offshore wave 1.62",row(7.6,16,37,1.62),"watch","sóng ngoài khơi");
check("screenshot 19h: rain 7 gust 33 offshore wave 1.53",row(7,15,33,1.53),"watch","mưa");
check("offshore wave alone gets caution",row(0,8,14,1.55),"watch","không đại diện sát bờ");
check("unverified offshore wave does NOT pretend to be nearshore",row(0,8,14,1.55,false),"good");
check("heavy rain 20mm per 3h",row(20,12,22,.6),"avoid","mưa lớn");
check("strong forecast gust",row(0,18,55,.6),"avoid","gió giật");
check("strong sustained wind",row(0,40,48,.6),"avoid","gió");
check("missing gust cannot be green",row(0,8,null,.6),"watch","Thiếu");
check("incomparable gust cannot be green",row(0,25,12,.6),"watch","Thiếu");
check("dry calm valid forecast",row(0,8,14,.6),"good");

{
  const helperStart=src.indexOf("function rainGaugeHasCurrentSignal(");
  const helperEnd=src.indexOf("\nfunction nearestRainGauge(",helperStart);
  assert(helperStart>=0&&helperEnd>helperStart,"Rain observation freshness helper is missing");
  const helperCtx={
    freshEnough:(iso,maxAge)=>{
      const age=(Date.parse("2026-10-01T05:20:00Z")-Date.parse(iso||""))/60000;
      return Number.isFinite(age)&&age>=0&&age<=maxAge;
    }
  };
  vm.runInNewContext(src.slice(helperStart,helperEnd)+"\nthis.rainGaugeHasCurrentSignal=rainGaugeHasCurrentSignal;",helperCtx);
  assert.equal(helperCtx.rainGaugeHasCurrentSignal({observed_at:"2026-10-01T05:10:00Z",increment_qc:"PASS"},45),true);
  assert.equal(helperCtx.rainGaugeHasCurrentSignal({observed_at:"2026-10-01T05:10:00Z",increment_qc:"NO_NEW_SENSOR_SAMPLE"},45),false);
  assert.equal(helperCtx.rainGaugeHasCurrentSignal({observed_at:"2026-10-01T03:00:00Z",increment_qc:"PASS"},45),false);
  assert(src.includes("Chưa ghi nhận tín hiệu mưa mới từ hệ thống quan trắc."));
  assert(src.includes("WMO 48917 · Dương Đông"),"WMO 48917 actual card is missing");
  assert(src.includes("ĐANG CHỜ ẢNH MÂY MỚI"),"source-specific Himawari waiting state is missing");
  assert(src.includes("Quan trắc mặt đất vẫn đang cập nhật"),"ground-current remote-waiting wording is missing");
  assert(src.includes("groundEvidenceFresh()"),"ground evidence freshness guard is missing");
  const scene=readFileSync("weather/weather-scene-v3.js","utf8");
  assert(scene.includes("Chưa ghi nhận tín hiệu mưa mới từ hệ thống quan trắc"));
}

console.log("10/10 multi-hazard forecast decisions PASS");
