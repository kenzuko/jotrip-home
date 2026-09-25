import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
const context={globalThis:{},window:undefined};
vm.createContext(context);
vm.runInContext(fs.readFileSync("core/go-geo.js","utf8"),context);
vm.runInContext(fs.readFileSync("core/go-engine.js","utf8"),context);
const geo=context.globalThis.OpenPQGoGeo,engine=context.globalThis.OpenPQGoEngine;
const origin={lat:10.0191,lon:104.0150};
assert.equal(geo.nearestArea(origin),"zone_south");
assert.ok(geo.distanceKm(origin,{lat:10.0201,lon:104.0150})<0.12);
assert.equal(geo.distanceKm(origin,{lat:10.34068,lon:103.85406})>35,true);
assert.equal(geo.destinationPoint({map:{lat:10.0201,lon:104.015,precision:"unverified"}}),null);
assert.equal(geo.mapPoints([{id:"x",name:"X",map:{lat:10.02,lon:104.016,precision:"site_centroid"}}],origin,2).length,1);
const pub={state:"PUBLISHED_SCHEDULE",schedule_type:"DAILY",windows:[{start:"06:00",end:"23:00"}],verified_at:"2026-09-25"};
const near={id:"place_near",name:"Near",zone_id:"zone_south",map:{lat:10.0201,lon:104.0151,precision:"site_centroid"},opening_hours:pub};
const far={id:"place_far",name:"Far",zone_id:"zone_north",map:{lat:10.3401,lon:103.8511,precision:"site_centroid"},opening_hours:pub};
const unknown={id:"place_unknown",name:"Unknown",zone_id:"zone_south",opening_hours:pub};
const config={activities:[near,far,unknown].map(e=>({entity_id:e.id,minimum_visit_min:35,entry_buffer_min:5,intents:["all"]}))};
const out=engine.plan({now:"2026-09-25T09:00:00Z",originZone:"zone_south",position:origin,radiusKm:2,available:"two",interest:"all",entities:[near,far,unknown],config,live:{},notices:[]});
assert.deepEqual(Array.from([...out.results,...out.remaining],x=>x.id),["place_near"]);
assert.ok(out.results[0].distance_km>0);
assert.ok(out.excluded.some(x=>x.id==="place_far"));
assert.ok(out.excluded.some(x=>x.id==="place_unknown"));
const manual=engine.plan({now:"2026-09-25T09:00:00Z",originZone:"zone_south",available:"two",interest:"all",entities:[near],config,live:{},notices:[]});
assert.equal(manual.results.length,1,"Manual-zone fallback remains functional");
console.log("go-geo radius, verified-pin, GPS and manual-mode tests passed");


// A regression in the original mobile page left /go outside the ecosystem.
// Keep a five-action dock and show the radius map before requesting GPS.
const goHtml=fs.readFileSync("go/index.html","utf8");
const homeHtml=fs.readFileSync("index.html","utf8");
const goJs=fs.readFileSync("go/go.js","utf8");
const goMap=fs.readFileSync("go/go-map.js","utf8");
assert.match(goHtml,/id="goRadiusPanel"(?![^>]*hidden)/,"radar map must appear without location permission");
assert.match(goHtml,/id="goRadiusRange"[^>]*min="1"[^>]*max="50"/,"km radius is adjustable");
assert.match(goHtml,/go-menu-open/);
assert.match(goHtml,/go-dock-more/);
assert.match(goHtml,/go-nav\.js/);
assert.match(homeHtml,/href="go\/"[^>]*><span>⌖<\/span><strong>Đi gì bây giờ\?/,"Go is in the shared More menu");
assert.match(goJs,/bindGeo\(\);\s*drawMap\(\);/,"draw reference map at first load");
assert.match(goMap,/groupPoints/,"overlapping area pins are grouped");
const dock=goHtml.match(/<nav class="go-mobile-nav"[^>]*>([\s\S]*?)<\/nav>/);
assert.ok(dock);
assert.equal((dock[1].match(/<(?:a|button)\b/g)||[]).length,5,"five mobile dock destinations");
console.log("go menu, visible radar, 1-50km slider and default map checks passed");
