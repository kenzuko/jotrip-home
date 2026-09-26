import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const read=file=>fs.readFileSync(file,"utf8");
const contextJs=read("core/hero-context.js");
const app=read("app.js"),css=read("styles.css"),html=read("index.html");
const sandbox={window:{},Intl,Date};
vm.runInNewContext(contextJs,sandbox);
const select=sandbox.window.OpenPQHeroContext.select;
const at=value=>new Date(value);
assert.equal(select(at("2026-09-26T00:00:00Z")).mood,"morning");
assert.equal(select(at("2026-09-26T06:00:00Z")).mood,"day");
assert.equal(select(at("2026-09-26T10:30:00Z")).mood,"sunset");
assert.equal(select(at("2026-09-26T14:00:00Z")).mood,"night");
const weather={
  signals:{weather_snapshot_age_min:25,observed_rain:true,convective_levels:["HIGH"]},
  live_status:{sunset:{primary:"17:45"}}
};
assert.equal(select(at("2026-09-26T06:00:00Z"),weather).mood,"rainy");
assert.equal(select(at("2026-09-26T14:00:00Z"),weather).mood,"rainy-night");
assert.equal(select(at("2026-09-26T06:00:00Z"),{
  ...weather,signals:{...weather.signals,weather_snapshot_age_min:130}
}).mood,"day","Stale weather never overrides the photograph");
assert.equal(select(at("2026-09-26T06:00:00Z"),{
  ...weather,signals:{weather_snapshot_age_min:18,observed_rain:true,convective_levels:[]}
}).mood,"day","Isolated rain does not imply a rainy island");
assert.equal(select(at("2026-09-26T06:00:00Z"),{
  ...weather,signals:{weather_snapshot_age_min:12,observed_rain:false,convective_levels:["ELEVATED"]}
}).mood,"cloudy");
assert.equal(select(at("2026-09-26T06:00:00Z"),{
  ...weather,signals:{weather_snapshot_age_min:10,observed_rain:false,convective_levels:[]},
  live_status:{sunset:{primary:"17:45"},sea:{primary:"1.9 m",freshness:"fresh"}}
}).mood,"cloudy","Rough sea near An Thoi avoids an active-boat hero");
assert.equal(select(at("2026-09-26T09:00:00Z"),{
  live_status:{sunset:{primary:"17:20"}}
}).mood,"sunset","Actual sunset from existing HOME context changes the editorial window");
assert.ok(html.includes('src="core/hero-context.js?')&&
  html.indexOf('src="core/hero-context.js?')<html.indexOf('src="app.js?'));
assert.ok(html.includes('class="hero-slides" aria-live="off"'));
assert.equal((html.match(/class="hero-slide(?: is-active)?"/g)||[]).length,4);
for(const path of [
  "assets/photos/tour-3-islands-jotrip-1600.jpg",
  "assets/media/jotrip-big-game-fishing-golden-hour-2025.jpg",
  "assets/media/jotrip-night-fishing-2025.jpg",
  "assets/media/jotrip-grilled-squid-2025.jpg"
]) assert.ok(fs.existsSync(path),"Missing approved local image "+path);
assert.match(app,/HERO_MOODS/);
assert.match(app,/openpq:live-ready/);
assert.match(app,/pendingMood/);
assert.match(app,/heroIndex/);
assert.match(app,/weatherSelectionApplied/);
assert.match(css,/#top>.hero.search-focused\s*\.search-results/);
assert.match(css,/top:calc\(100% \+ 8px\)!important/);
assert.match(css,/bottom:auto!important/);
assert.match(app,/visualViewport\?\.addEventListener\("resize"/);
assert.match(app,/syncMobileSearch/);
assert.match(app,/searchInput\.focus\(\{preventScroll:true\}\)/);
assert.match(app,/if \(q.length < 2\) return closeSearchResults\(\{keepFocus:true\}\)/);
console.log("Homepage contextual slideshow and mobile search regression tests passed.");
