import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const js=fs.readFileSync("weather/weather-v2.js","utf8");
const html=fs.readFileSync("weather/index.html","utf8");

assert.match(js,/actual\.synop_48917\s*=\s*\{/,"Weather V2 must keep SYNOP 48917 as a separate actual stream");
assert.match(js,/SYNOP_48917:"Quan trắc SYNOP 48917"/,"Weather V2 must expose the 48917 source label");
assert.match(html,/weather-v2\.js\?v=20261001-human-layer1/,"Weather V2 cache-bust must ship with the Human Layer UI");
assert.ok(js.includes("rain:/RA|DZ/.test(wx)"),"VVPQ TS alone must not be treated as measured rain");
assert.ok(!js.includes("rain:/RA|SHRA|TS/.test(wx)"),"TS without a precipitation code must not imply rain");
assert.doesNotMatch(js,/thunder:\/TS\/\.test\(wx\)\|\|Boolean\(v\.convective_cloud\)/,"convective cloud must not be relabelled as observed thunder");

const start=js.indexOf("function groundTruthHealthSources(){");
const end=js.indexOf("function renderHealth(){",start);
assert.ok(start>=0&&end>start,"groundTruthHealthSources helper must exist");
const helper=js.slice(start,end);

function renderSources(synop){
  const context={
    critical:{
      _groundtruth:{
        atmosphere:{
          vvpq:{status:"FRESH",observed_at:"2026-10-01T09:00:00Z"},
          synop_48917:synop
        },
        rainfall:{
          status:"FRESH",
          stations:{an_thoi:{observed_at:"2026-10-01T09:00:00Z"}}
        }
      }
    },
    ageText:()=> "vừa cập nhật"
  };
  vm.createContext(context);
  vm.runInContext(helper+"\nresult=groundTruthHealthSources();",context);
  return context.result;
}

const eligible=renderSources({
  status:"FRESH",numeric_status:"FRESH",runtime_eligible:true,
  latest_numeric_observed_at:"2026-10-01T06:00:00Z"
});
assert.equal(eligible.SYNOP_48917.status,"PASS","fresh eligible 48917 must be public-ready");
assert.match(eligible.SYNOP_48917.detail,/độc lập với VVPQ/,"UI must state 48917 remains independent from VVPQ");

const gated=renderSources({
  status:"FRESH",numeric_status:"FRESH",runtime_eligible:false,
  latest_numeric_observed_at:"2026-10-01T06:00:00Z"
});
assert.equal(gated.SYNOP_48917.status,"PARTIAL","fresh but gated 48917 must not be shown as ready");

const stale=renderSources({
  status:"STALE",numeric_status:"STALE",runtime_eligible:false,
  latest_numeric_observed_at:"2026-09-30T18:00:00Z"
});
assert.equal(stale.SYNOP_48917.status,"PARTIAL","stale 48917 must remain visible but degraded");

assert.equal(eligible.VVPQ.status,"PASS");
assert.match(js,/VVPQ · Dương Tơ[\s\S]*METAR\/SPECI/,"VVPQ must be shown as a periodic METAR/SPECI observation");
assert.equal(eligible.VRAIN.status,"PASS");

console.log("Weather V2 Ground Truth UI contract: PASS");
