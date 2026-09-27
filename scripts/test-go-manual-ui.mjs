import assert from "node:assert/strict";
import fs from "node:fs";
const html=fs.readFileSync("go/index.html","utf8");
const js=fs.readFileSync("go/go.js","utf8");
const css=fs.readFileSync("go/go.css","utf8");
const mapJs=fs.readFileSync("go/go-map.js","utf8");
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
assert.ok(js.includes('function syncRadiusControls()'),"Radius controls must track the selected radius even when map drawing fails");
const areaMode=js.indexOf('$("#goMapMode").textContent=modeText;');
const mapDraw=js.indexOf('result=window.OpenPQGoMap?.draw(point,state.radiusKm,mapRows(),{gps});');
assert.ok(areaMode>=0&&mapDraw>areaMode,"Selected area copy updates before the optional map draw");
assert.ok(js.includes('GO radius map drawing failed')&&js.includes('Bản đồ chưa tải được; bạn vẫn có thể chọn khu vực và nhận gợi ý.'),"Map errors must not interrupt GO or leave stale area copy");
assert.ok(css.includes('.go-mobile-nav button.go-dock-more::before'),"Active dock must carry homepage-style coral bar");
assert.ok(css.includes('.go-footer{padding:26px 16px 17px!important}'),"Do not duplicate fixed dock spacing inside footer");
assert.ok(html.includes('src="../map-basemap.js?')&&html.indexOf('src="../map-basemap.js?')<html.indexOf('src="go-map.js?'),"GO must load shared basemap before its map script");
assert.ok(mapJs.includes('OpenPQMapBase?.add?.(map')&&mapJs.includes('basemap?.fallback?.()'),"GO should recover when map tiles do not load");
assert.ok(mapJs.includes("fitVisible(L.latLngBounds(ISLAND_FRAME))")&&mapJs.includes("ResizeObserver"),"Whole-island frame should survive mobile resizes");
assert.ok(css.includes('height:clamp(315px,88vw,410px)'),"Mobile map should be tall enough to fit the island");
assert.match(html,/<\/fieldset>\s*<section class="go-radius-panel" id="goRadiusPanel"/,
  "The GO map must sit beside the form on desktop and follow the origin controls on mobile");
assert.ok(html.indexOf('id="goRadiusPanel"')>html.indexOf('id="areaChoices"')&&
  html.indexOf('id="goRadiusPanel"')<html.indexOf('value="two"'),
  "Native map follows origin but precedes the time decision in document order");
assert.match(html,/id="goRadiusControls" hidden/,"Do not show inactive radius controls before an origin is selected");
assert.match(html,/class="go-radius-more"/,"Keep custom radius collapsed until requested");
assert.equal((html.match(/data-go-map-area=/g)||[]).length,3,"Map offers three clear manual-region shortcuts");
assert.match(css,/@media\(min-width:1000px\)\{/,"Desktop must have a dedicated two-column workspace");
assert.match(css,/\.go-form>\.go-radius-panel\{/,"Native map must be an independent workspace panel");
assert.match(mapJs,/fitVisible\(bounds,selected<=2\?13:/,"Selected map must focus on the chosen radius");
assert.doesNotMatch(mapJs,/Quarter-distance guides/,"Remove the crowded nested radar rings");
console.log("GO desktop workspace contracts PASS: map-first UX, separated heading, simple radius, preserved manual/GPS.");
