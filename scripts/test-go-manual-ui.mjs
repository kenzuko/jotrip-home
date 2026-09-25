import assert from "node:assert/strict";
import fs from "node:fs";
const html=fs.readFileSync("go/index.html","utf8");
const js=fs.readFileSync("go/go.js","utf8");
const css=fs.readFileSync("go/go.css","utf8");
const areas=html.match(/<div class="choice-grid" id="areaChoices"[\s\S]*?<\/div>/)?.[0]||"";
for(const id of ["zone_central_west","zone_south","zone_north"]){
  assert.ok(areas.includes('name="origin" value="'+id+'"'),"Missing static manual zone "+id);
}
assert.equal((areas.match(/name="origin"/g)||[]).length,3,"Render exactly three manual regions without JS");
assert.ok(html.indexOf('id="areaChoices"')<html.indexOf('id="goLocate"'),"Manual zone must precede optional GPS");
assert.ok(js.includes('const state={config:null,entities:new Map()')&&js.includes('originZone:null'),"Do not silently claim a user's location");
assert.ok(js.includes('input.nextElementSibling.textContent=area.label'),"Canonical area labels update in place");
assert.ok(!js.includes('$("#areaChoices").innerHTML'),"Never replace manual choices during loading/error");
assert.ok(js.indexOf('  bindGeo();\n  drawMap();\n  load().catch')>0,"Bind manual controls before fetching data");
assert.ok(js.includes('state.position=null'),"Manual selection must remain available after GPS");
assert.ok(css.includes('.go-mobile-nav button.go-dock-more::before'),"Active dock must carry homepage-style coral bar");
assert.ok(css.includes('.go-footer{padding:26px 16px 17px!important}'),"Do not duplicate fixed dock spacing inside footer");
console.log("go manual area / GPS fallback / dock / footer regressions passed");
