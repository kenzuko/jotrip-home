import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const context={globalThis:{},window:undefined};
vm.createContext(context);
vm.runInContext(fs.readFileSync("core/go-engine.js","utf8"),context);
const engine=context.globalThis.OpenPQGoEngine;
assert.ok(engine,"Go engine should load");

const entity=(id,zone,opening,duration="60 phút",extra={})=>({id,name:id,zone_id:zone,opening_hours:opening,duration,...extra});
const pub=(windows)=>({state:"PUBLISHED_SCHEDULE",schedule_type:"DAILY",windows,verified_at:"2026-09-25"});
const fixed=(time)=>({state:"PUBLISHED_SCHEDULE",schedule_type:"FIXED_START",times:[{start:time}],verified_at:"2026-09-25"});

{
  const entities=[entity("activity_hon_thom","zone_south",{state:"PUBLISHED_SCHEDULE",schedule_type:"MULTI_WINDOW",windows:[{start:"15:30",end:"17:30"}],verified_at:"2026-09-25"},"4-8 giờ")];
  const config={activities:[{entity_id:"activity_hon_thom",minimum_visit_min:240,entry_buffer_min:25,environment:"outdoor",intents:["sea"]}]};
  const r=engine.plan({now:"2026-09-25T08:40:00Z",originZone:"zone_south",available:"two",interest:"sea",entities,config,live:{weather:{freshness:"fresh",status:"normal",source_updated_at:"2026-09-25T08:30:00Z"}},notices:[]});
  assert.equal(r.results.length,0,"Hòn Thơm must be excluded when 2h is insufficient");
}

{
  const entities=[entity("activity_show","zone_south",fixed("21:00"),"30 phút")];
  const config={activities:[{entity_id:"activity_show",minimum_visit_min:30,entry_buffer_min:25,environment:"outdoor",intents:["evening"]}]};
  const r=engine.plan({now:"2026-09-25T12:00:00Z",originZone:"zone_south",available:"evening",interest:"evening",entities,config,live:{weather:{freshness:"fresh",status:"normal",source_updated_at:"2026-09-25T11:50:00Z"}},notices:[]});
  assert.equal(r.results[0]?.id,"activity_show","Evening show should remain feasible");
}

{
  const entities=[entity("activity_boat","zone_south",pub([{start:"05:00",end:"22:00"}]),"2 giờ")];
  const config={activities:[{entity_id:"activity_boat",minimum_visit_min:120,entry_buffer_min:20,environment:"marine",marine:true,operational_binding:"cano",intents:["sea"]}]};
  const r=engine.plan({now:"2026-09-25T02:00:00Z",originZone:"zone_south",available:"half",interest:"sea",entities,config,live:{cano:{state:"SUSPENDED",freshness:"fresh",source_updated_at:"2026-09-25T01:30:00Z"},weather:{freshness:"fresh",status:"normal",source_updated_at:"2026-09-25T01:30:00Z"}},notices:[]});
  assert.equal(r.results.length,0,"Fresh same-day SUSPENDED canoe state must block marine activity");
}

{
  const entities=[entity("place_walk","zone_central_west",pub([{start:"07:00",end:"21:00"}]),"45 phút")];
  const config={activities:[{entity_id:"place_walk",minimum_visit_min:45,entry_buffer_min:5,environment:"outdoor",intents:["relax"]}]};
  const r=engine.plan({now:"2026-09-25T08:00:00Z",originZone:"zone_central_west",available:"two",interest:"relax",entities,config,live:{weather:{freshness:"stale",status:"unknown",source_updated_at:"2026-09-24T08:00:00Z"}},notices:[]});
  assert.equal(r.results.length,1,"Stale weather should warn, not silently remove ordinary outdoor place");
  assert.equal(r.results[0].badge,"CHECK");
}


{
  const entities=["a","b","c","d"].map(id=>entity("place_"+id,"zone_central_west",pub([{start:"07:00",end:"21:00"}]),"45 phút"));
  const config={activities:entities.map(e=>({entity_id:e.id,minimum_visit_min:45,entry_buffer_min:5,environment:"outdoor",intents:["relax"]}))};
  const r=engine.plan({now:"2026-09-25T08:00:00Z",originZone:"zone_central_west",available:"two",interest:"relax",entities,config,live:{},notices:[]});
  assert.equal(r.results.length,3,"the visible recommendation list should remain capped at three");
  assert.equal(r.remaining.length,1,"additional eligible candidates should remain available");
  assert.equal(r.eligible.length,4,"forecast evaluation must be able to inspect every eligible candidate before display truncation");
  assert.equal(r.eligible[0].arrival_at,"2026-09-25T15:30+07:00","arrival should retain the Vietnam local date and UTC+7 offset");
  assert.equal(r.eligible[0].starts_at_local,"2026-09-25T15:30+07:00");
  assert.equal(r.eligible[0].finish_at_local,"2026-09-25T16:15+07:00");
}


{
  // Public, independently sourced experiences can broaden GO without
  // claiming that a free stroll is a paid show or that visiting windows
  // are operator opening hours.
  const cfg=JSON.parse(fs.readFileSync("data/go-config.json","utf8"));
  const places=JSON.parse(fs.readFileSync("data/entities/places.json","utf8")).entities;
  const byId=new Map(places.map(p=>[p.id,p]));
  const selected=["place_sunset_town","place_bai_truong","place_cua_can"];
  const publicCfg=cfg.activities.filter(c=>selected.includes(c.entity_id));
  assert.equal(publicCfg.length,3);
  for(const [id,origin,when,available] of [
    ["place_sunset_town","zone_south","2026-09-27T17:00:00+07:00","evening"],
    ["place_bai_truong","zone_central_west","2026-09-27T15:00:00+07:00","half"],
    ["place_cua_can","zone_north","2026-09-27T10:00:00+07:00","half"]
  ]){
    const subset=publicCfg.filter(c=>c.entity_id===id);
    const item=byId.get(id);
    assert.ok(item&&item.zone_id===origin,"Missing canonical zone for "+id);
    const plan=engine.plan({now:when,available,originZone:origin,config:{activities:subset},entities:[item],interest:"all"});
    assert.equal(plan.eligible_count,1,"Public GO experience should fit safe daypart: "+id);
    assert.equal(plan.results[0].id,id);
    assert.ok(plan.results[0].warnings.some(w=>/thời tiết|tham khảo|xác nhận/.test(w)),"Missing weather or operational caveat for "+id);
    if(id!=="place_sunset_town"){
      assert.ok(plan.results[0].warnings.some(w=>/Khung giờ tham khảo/.test(w)),"Soft window must not be treated as opening hours");
    }else{
      assert.ok(!plan.results[0].warnings.some(w=>/Khung giờ tham khảo/.test(w)),"Sunset Town pedestrian access has operator hours");
    }
  }
}
console.log("go-engine tests passed");