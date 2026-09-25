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


// V1.2: layer filtering, sorted lists and no-GPS manual map origin.
vm.runInContext(fs.readFileSync("core/go-layers.js","utf8"),context);
const layers=context.globalThis.OpenPQGoLayers;
const layerRows=[
  {id:"p",name:"Dinh Cau",entity_type:"place",map:{lat:10.0192,lon:104.015,precision:"site_centroid"}},
  {id:"a",name:"Show",entity_type:"activity",map:{lat:10.0198,lon:104.015,precision:"area_anchor"}},
  {id:"u",name:"Pharmacy",entity_type:"utility",map:{lat:10.0201,lon:104.015,precision:"site_centroid"}},
  {id:"h",name:"Hotel",entity_type:"hotel",map:{lat:10.0193,lon:104.015,precision:"site_centroid"}},
  {id:"f",name:"Local restaurant",entity_type:"venue",category:"LOCAL_FOOD",map:{lat:10.0194,lon:104.015,precision:"site_centroid"}},
  {id:"bad",name:"Unverified restaurant",entity_type:"venue",category:"LOCAL_FOOD",map:{lat:10.0195,lon:104.015,precision:"unverified"}}
];
assert.deepEqual(Array.from(layers.filter(layerRows,"explore"),x=>x.id),["p","a"],"default map does not overwhelm with hotel pins");
assert.deepEqual(Array.from(layers.filter(layerRows,"utility"),x=>x.id),["u"]);
assert.deepEqual(Array.from(layers.filter(layerRows,"food"),x=>x.id),["f","bad"]);
assert.deepEqual(Array.from(geo.mapPoints(layers.filter(layerRows,"food"),origin,2),x=>x.id),["f"],"unverified food must never acquire a pin");
assert.deepEqual(Array.from(layers.sortPoints(geo.mapPoints(layerRows,origin,2),"name"),x=>x.id),["p","h","f","u","a"],"name sorting is stable");
const manualPoint={lat:10.0201,lon:104.016};
const selected=geo.mapPoints(layers.filter(layerRows,"explore"),manualPoint,2);
assert.equal(selected.length,2,"manual map origin must work without GPS");
const updatedHtml=fs.readFileSync("go/index.html","utf8");
const updatedJs=fs.readFileSync("go/go.js","utf8");
const updatedMap=fs.readFileSync("go/go-map.js","utf8");
const updatedCss=fs.readFileSync("go/go.css","utf8");
for(const id of ["goPickMap","goRadiusRange","goLayerControls","goMapSort","goMapList"]){
  assert.ok(updatedHtml.includes('id="'+id+'"'),"missing workspace control: "+id);
}
assert.match(updatedHtml,/go-location-workspace/,"desktop map and filters share one workspace");
assert.match(updatedHtml,/go-layers\.js/,"load the pure shared layers");
assert.match(updatedJs,/state\.manualPoint=point/,"map taps set manual origin without GPS");
assert.match(updatedJs,/state\.position\|\|state\.manualPoint/,"manual map origin reaches Go engine");
assert.match(updatedJs,/OpenPQGoLayers/,"map layers are applied to real data");
assert.match(updatedJs,/goMapSort/,"sorting is interactive");
assert.match(updatedMap,/selectionHandler\(point\)/,"map-click callback is wired");
assert.match(updatedMap,/map\.on\("click"/,"tapping map selects origin when enabled");
assert.match(updatedCss,/go-location-workspace\{display:grid/,"desktop layout is a two-column workspace");
assert.match(updatedCss,/@media\(max-width:760px\)\{[\s\S]*?go-location-workspace\{display:block/,"mobile retains stacked layout");
console.log("go V1.2 no-GPS selection, layers, sorting and responsive workspace tests passed");
