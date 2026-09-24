import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const js=readFileSync("weather/weather-v2.js","utf8");
const html=readFileSync("weather/index.html","utf8");
const css=readFileSync("weather/weather-v2.css","utf8");
for(const needle of [
 "const referenceOnly=!verified&&snapshotAge>=0&&snapshotAge<=360",
 "cycleAges.some(a=>a>=0&&a<=30*60)",
 "Không hiển thị các mốc cũ như dự báo hiện tại",
 "Bản tổng hợp trễ",
 "setInterval(refreshLive,LIVE_REFRESH_MS)",
 "if(engineDashboard){renderTodayDecision();return}"
])assert.ok(js.includes(needle),"CMS auto-recovery contract missing: "+needle);
assert.ok(!js.includes("snapshotAge<=360||"),"stale reference gate must require valid cycle");
assert.ok(html.includes("20260924-freshness1"),"JS/CSS cache bust missing");
assert.ok(css.includes(".today-decision-panel .today-reference-notice"),"compact stale-data status styling missing");
const dashboard=(generatedAt,cycleAt,now)=>({
 generated_at:new Date(now-generatedAt*60000).toISOString(),
 source_cycles:{ECMWF:new Date(now-cycleAt*60000).toISOString()}
});
const reference=(d,now,verified=false)=>{
 const age=(t)=>(now-Date.parse(t))/60000;
 const snapshotAge=age(d.generated_at);
 const cycleAges=[d.source_cycles.ECMWF,d.source_cycles.ICON].map(age);
 return !verified&&snapshotAge>=0&&snapshotAge<=360&&cycleAges.some(a=>a>=0&&a<=1800);
};
const now=Date.parse("2026-09-24T05:27:00Z");
assert.equal(reference(dashboard(220,687,now),now),true,"screenshot scenario: 3h40 snapshot and 11h cycle show reference");
assert.equal(reference(dashboard(370,687,now),now),false,"snapshot older than six hours blocked");
assert.equal(reference(dashboard(220,1900,now),now),false,"model cycle older than thirty hours blocked");
assert.equal(reference(dashboard(220,687,now),now,true),false,"fresh verified forecast never downgraded");
console.log("PASS CMS Weather auto-recovery gates, screenshot scenario, cache bust and compact stale-data notice");
