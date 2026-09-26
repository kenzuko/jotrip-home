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

const frameEvents=[];
const mockMap={
  setView(){return this;},on(){return this;},invalidateSize(){return this;},
  fitBounds(bounds){frameEvents.push({...bounds});return this;},removeLayer(){}
};
const box=([south,west],[north,east])=>({
  south,west,north,east,
  extend(other){
    this.south=Math.min(this.south,other.south);this.west=Math.min(this.west,other.west);
    this.north=Math.max(this.north,other.north);this.east=Math.max(this.east,other.east);
    return this;
  }
});
const fakeL={
  map:()=>mockMap,
  latLngBounds:bounds=>box(bounds[0],bounds[1]),
  tileLayer:()=>({addTo(){return this;}}),
  layerGroup:()=>({addTo(){return this;},clearLayers(){}}),
  divIcon:x=>x,
  marker:()=>({addTo(){return this;},bindPopup(){return this;},setLatLng(){return this;},setIcon(){return this;}}),
  circle:(center,options)=>({
    addTo(){return this;},
    getBounds(){
      const dy=options.radius/111000,dx=dy/Math.cos(center[0]*Math.PI/180);
      return box([center[0]-dy,center[1]-dx],[center[0]+dy,center[1]+dx]);
    }
  }),
  circleMarker:()=>({bindPopup(){return this;},addTo(){return this;}})
};
const mapWindow={L:fakeL,OpenPQGoGeo:geo};
vm.runInNewContext(goMap,{window:mapWindow,L:fakeL,document:{getElementById:()=>({})},
  requestAnimationFrame:fn=>fn(),setTimeout:fn=>fn()});
const fullIsland=b=>b.south<=9.88&&b.north>=10.46&&b.west<=103.79&&b.east>=104.16;
assert.equal(mapWindow.OpenPQGoMap.overview(),true,"Island overview available");
assert.ok(fullIsland(frameEvents.at(-1)),"Overview frames the entire island on mobile");
mapWindow.OpenPQGoMap.draw({lat:10.2172,lon:103.9593},5,[],{gps:false});
assert.ok(fullIsland(frameEvents.at(-1)),"5km radar must not crop the northern/southern coast");
mapWindow.OpenPQGoMap.draw({lat:10.3759,lon:103.90},50,[],{gps:false});
assert.ok(fullIsland(frameEvents.at(-1))&&frameEvents.at(-1).north>10.6,
  "Large north-island radius must include both island and the complete ring");
console.log("go island viewport and radial overlay tests passed");
