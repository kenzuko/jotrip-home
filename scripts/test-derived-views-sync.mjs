// Exercise the drift gate in both directions and restore fixtures on every path.
import assert from "node:assert/strict";
import fs from "node:fs";
import {spawnSync} from "node:child_process";
const loc="data/views/location-index.json";
const map="data/views/map-coverage.json";
const l=fs.readFileSync(loc),m=fs.readFileSync(map);
function check(expectPass){
  const p=spawnSync(process.execPath,["scripts/check-derived-views-sync.mjs"],
    {encoding:"utf8"});
  assert.equal(p.status===0,expectPass,
    "Derived view guard "+(expectPass?"rejected a valid index":"accepted stale data")+
    ": "+(p.stderr||p.stdout).slice(0,800));
}
try{
  check(true);
  const staleLoc=JSON.parse(l);
  const omitted=staleLoc.documents.findIndex(d=>d.entity_type==="utility");
  assert.ok(omitted>=0);
  staleLoc.documents.splice(omitted,1);
  fs.writeFileSync(loc,JSON.stringify(staleLoc));
  check(false);
  fs.writeFileSync(loc,l);
  check(true);
  const staleMap=JSON.parse(m);
  staleMap.summary.ready_count--;
  fs.writeFileSync(map,JSON.stringify(staleMap));
  check(false);
  fs.writeFileSync(map,m);
  check(true);
  console.log("Near Me drift gate regression PASS: valid indexes accepted; stale location/map rejected");
}finally{
  fs.writeFileSync(loc,l);fs.writeFileSync(map,m);
}
