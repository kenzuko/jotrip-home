import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const venue=require("../nearme/venue-normalizer.js");
const geo=require("../core/go-geo.js");
const appSource=fs.readFileSync("nearme/nearme.js","utf8");

class FakeNode{
  constructor(id){this.id=id;this.handlers={};this.dataset={};this.innerHTML="";this.textContent="";this.value="";this.hidden=false;this.disabled=false;this.open=false;this.attributes={};this.classList={toggle(){},add(){},remove(){}};}
  addEventListener(type,fn){(this.handlers[type]??=[]).push(fn);}
  async emit(type,event={}){let result;for(const fn of this.handlers[type]||[])result=await fn(event);return result;}
  setAttribute(name,value){this.attributes[name]=String(value);}
  getAttribute(name){return this.attributes[name]??null;}
  querySelector(){return null;}
  focus(){}
  scrollIntoView(){}
}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function createRuntime({failData=false}={}){
  const ids=["#areaRow","#categoryRow","#quickCategoryRow","#radiusRow","#radiusNote","#nearSearch","#useLocation","#nearStatus","#nearResults","#resultsTitle","#resultsCount","#nearMapShell","#nearMapToggle","#nearLeaflet","#nearDirectoryMap","#mapOpenLink","#mapDataBadge","#mapNote","#nearMap","#categoryMore","#categoryMore summary"];
  const nodes=new Map(ids.map(id=>[id,new FakeNode(id)]));
  let leafletScripts=0;
  const document={
    querySelector(selector){return nodes.get(selector)||null;},
    querySelectorAll(){return[];},
    getElementById(id){if(!nodes.has(id))nodes.set(id,new FakeNode(id));return nodes.get(id);},
    createElement(tag){const node=new FakeNode(tag);node.tagName=tag;return node;},
    head:{appendChild(node){if(node.tagName==="script"){leafletScripts++;setTimeout(()=>node.onerror?.(),0);}}}
  };
  const support={near_me:{
    manual_areas:[
      {id:"all",label:"Toàn đảo"},
      {id:"zone_south",label:"An Thới",map_query:"An Thới, Phú Quốc"}
    ],
    categories:[
      {id:"PHARMACY",label:"Nhà thuốc",icon:"+"},
      {id:"LOCAL_FOOD",label:"Ăn uống",mode:"directory_search",search_query:"quán ăn"},
      {id:"BEACH",label:"Bãi biển"}
    ],
    items:[]
  }};
  const index={documents:[
    {id:"pharmacy_near",name:"Nhà thuốc An Thới",entity_type:"utility",zone_id:"zone_south",tags:["PHARMACY"],address:"An Thới",map:{lat:10.0191,lon:104.015,precision:"site_centroid"}},
    {id:"pharmacy_far",name:"Nhà thuốc xa",entity_type:"utility",zone_id:"zone_south",tags:["PHARMACY"],address:"Nam đảo",map:{lat:10.15,lon:104.15,precision:"site_centroid"}},
    {id:"pharmacy_unknown",name:"Nhà thuốc chưa rõ pin",entity_type:"utility",zone_id:"zone_south",tags:["PHARMACY"],address:"An Thới",map:null},
    {id:"pharmacy_zero",name:"Nhà thuốc lỗi tọa độ 0,0",entity_type:"utility",zone_id:"zone_south",tags:["PHARMACY"],address:"An Thới",map:{lat:0,lon:0,precision:"site_centroid"}},
    {id:"place_bai_sao",name:"Bãi Sao",entity_type:"place",zone_id:"zone_south",tags:["BEACH"],address:"Nam đảo",map:{lat:10.01,lon:104.01,precision:"site_centroid"}}
  ]};
  const data={
    "../data/home-support.json":support,
    "../data/views/location-index.json":index,
    "../data/entities/destination-venues.json":{entities:[]}
  };
  const calls=[];
  const window={
    matchMedia:()=>({matches:false}),
    OpenPQVenue:venue,
    OpenPQGoGeo:geo,
    OpenPQArea:{get:()=>null,nearest:()=> "zone_south",set:(id,source)=>calls.push({area:id,source})},
    OpenPQWeatherContext:{requestWindows:async items=>{
      calls.push({weather:items});
      return {items:[{entity_id:items[0].entity_id,status:"OK",
        temporal_coverage:{status:"IN_WINDOW_FRAMES",frame_cadence_hours:3},
        frames:[{native_cell:{distance_from_target_km:2.1}}]}]};
    }}
  };
  const navigator={geolocation:{getCurrentPosition(_success,error){error({code:1});}}};
  const location={search:"",href:"https://cms.openphuquoc.com/nearme/"};
  const fetch=async url=>{
    calls.push({fetch:String(url)});
    if(failData)throw new Error("offline");
    const path=Object.keys(data).find(key=>String(url).startsWith(key));
    return {ok:!!path,json:async()=>data[path]};
  };
  const context={window,document,navigator,location,fetch,console:{warn(){}},setTimeout,clearTimeout,URLSearchParams,Date,Map,Set,Math,Number,String,Array,Object,Promise,encodeURIComponent};
  vm.createContext(context);
  vm.runInContext(appSource,context,{filename:"nearme.js"});
  return {nodes,calls,get leafletScripts(){return leafletScripts},window};
}

{
  const app=createRuntime();
  await delay(10);
  assert.equal(app.leafletScripts,0,"mobile first view must not download Leaflet");
  await app.nodes.get("#useLocation").emit("click");
  assert.match(app.nodes.get("#nearStatus").textContent,/vẫn có thể tìm/i,"GPS denied must leave manual search available");
  await app.nodes.get("#areaRow").emit("click",{target:{closest:selector=>selector==="[data-area]"?{dataset:{area:"zone_south"}}:null}});
  await app.nodes.get("#quickCategoryRow").emit("click",{target:{closest:selector=>selector==="[data-category]"?{dataset:{category:"PHARMACY"}}:null}});
  assert.match(app.nodes.get("#quickCategoryRow").innerHTML,/data-category="PHARMACY"/,"priority category shortcut remains present");
  app.nodes.get("#nearSearch").value="nha thuoc";
  await app.nodes.get("#nearSearch").emit("input",{target:app.nodes.get("#nearSearch")});
  await delay(170);
  assert.equal(app.window.__openpqNearState.visibleCount,4,"GPS denial and unaccented Vietnamese search must retain matching services");
  assert.doesNotMatch(app.nodes.get("#nearResults").innerHTML,/tel:/,"missing phone must not create a call action");

  await app.nodes.get("#radiusRow").emit("click",{target:{closest:selector=>selector==="[data-radius]"?{dataset:{radius:"2"},disabled:false}:null}});
  assert.equal(app.window.__openpqNearState.radiusKm,2);
  assert.equal(app.window.__openpqNearState.visibleCount,3,"radius keeps nearby geocoded results plus clearly separate unknown-location rows");
  assert.match(app.nodes.get("#nearResults").innerHTML,/không tính trong vòng 2 km/i);
  assert.equal(app.window.__openpqNearState.radiusCount,1);
  assert.equal(app.window.__openpqNearState.radiusUnknown,2,"missing and invalid 0,0 coordinates are never assigned a distance");

  await app.nodes.get("#categoryRow").emit("click",{target:{closest:selector=>selector==="[data-category]"?{dataset:{category:""}}:null}});
  app.nodes.get("#nearSearch").value="Bãi Sao";
  await app.nodes.get("#nearSearch").emit("input",{target:app.nodes.get("#nearSearch")});
  await delay(170);
  assert.match(app.nodes.get("#nearResults").innerHTML,/data-weather-id="place_bai_sao"/,"only weather-relevant selected place gets a weather action");
  await app.nodes.get("#nearResults").emit("click",{target:{closest:selector=>selector==="[data-weather-id]"?{dataset:{weatherId:"place_bai_sao"},disabled:false}:null}});
  const weatherCall=app.calls.find(x=>x.weather)?.weather;
  assert.equal(weatherCall.length,1,"weather is requested only after selecting one card");
  assert.equal(weatherCall[0].entity_id,"place_bai_sao");
  assert.equal(weatherCall[0].location.precision,"site_centroid");
  assert.equal(app.nodes.get("weatherStatus_place_bai_sao").textContent.includes("2.1 km"),true);
  assert.equal(app.calls.filter(x=>x.weather).length,1,"not one Weather request per map marker");

  await app.nodes.get("#nearMapToggle").emit("click");
  await delay(10);
  assert.equal(app.leafletScripts,1,"Leaflet is loaded only after the user opens the map");
}

{
  const app=createRuntime({failData:true});
  await delay(10);
  assert.equal(app.nodes.get("#nearSearch").disabled,false,"search stays enabled when support and index requests fail");
  await app.nodes.get("#quickCategoryRow").emit("click",{target:{closest:selector=>selector==="[data-category]"?{dataset:{category:"PHARMACY"}}:null}});
  assert.match(app.nodes.get("#nearResults").innerHTML,/Mở trên Google Maps/,"quick category remains usable without support data");
  assert.match(app.nodes.get("#nearResults").innerHTML,/nh%C3%A0%20thu%E1%BB%91c/i,"fallback keeps the pharmacy category in its Maps query");
  app.nodes.get("#nearSearch").value="nhà thuốc";
  await app.nodes.get("#nearSearch").emit("input",{target:app.nodes.get("#nearSearch")});
  await delay(170);
  assert.match(app.nodes.get("#nearResults").innerHTML,/Mở trên Google Maps/,"data failure leaves a direct, explicitly unverified Maps fallback");
  assert.match(app.nodes.get("#nearResults").innerHTML,/nhà thuốc/);
}
assert.match(appSource,/const mapped=visible\.filter\(x=>validPoint\(\{lat:x\.lat,lon:x\.lon\}\)\)/,"invalid coordinates must never create map markers");
console.log("Near Me search, denied GPS, radius, selected-place Weather and lazy-map regressions passed");
