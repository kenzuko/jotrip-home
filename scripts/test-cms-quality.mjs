import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {webcrypto} from "node:crypto";

if(!globalThis.crypto)globalThis.crypto=webcrypto;
const secret="quality-test-key",enc=new TextEncoder();
const digest=await webcrypto.subtle.digest("SHA-256",enc.encode(secret));
const key=await webcrypto.subtle.importKey("raw",digest,{name:"AES-GCM"},false,["encrypt"]);
const iv=webcrypto.getRandomValues(new Uint8Array(12));
const payload={login:"kenzuko",exp:Date.now()+60000};
const cipher=await webcrypto.subtle.encrypt({name:"AES-GCM",iv},key,enc.encode(JSON.stringify(payload)));
const token=Buffer.from(iv).toString("base64url")+"."+Buffer.from(cipher).toString("base64url");
const env={CMS_SESSION_SECRET:secret};
const source=fs.readFileSync(path.join(process.cwd(),"functions/api/cms/quality.js"),"utf8");
const {onRequest}=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
const originalFetch=globalThis.fetch;
const calls=[];
globalThis.fetch=async url=>{
  const target=String(url);calls.push(target);
  if(target.startsWith("https://raw.githubusercontent.com/kenzuko/jotrip-home/main/cms/users.json"))return Response.json({users:[{login:"kenzuko",role:"admin",enabled:true}]});
  if(target.startsWith("https://raw.githubusercontent.com/kenzuko/jotrip-home/main/data/entities/destination-venues.json"))return Response.json({entities:[
    {id:"venue_a",name:"Điểm A",category:"ATTRACTION",status:"ACTIVE",latitude:10,longitude:104,source_ref:"src-a",verified_at:"2026-09-22"},
    {id:"venue_b",name:"Điểm B",category:"ATTRACTION",status:"REVIEW",latitude:null,longitude:104}
  ]});
  if(target.startsWith("https://raw.githubusercontent.com/kenzuko/jotrip-home/main/data/entities/food.json"))return Response.json({entities:[
    {id:"food_ghe",legacy_id:"ghe-ham-ninh",name:"Ghẹ Hàm Ninh"}
  ]});
  if(target.startsWith("https://raw.githubusercontent.com/kenzuko/jotrip-home/main/data/food.json"))return Response.json({dishes:[]});
  throw new Error("Unexpected request "+target);
};
const request=(withCookie,method="GET",body)=>new Request("https://cms.openphuquoc.com/api/cms/quality",{method,headers:{origin:"https://cms.openphuquoc.com",...(withCookie?{cookie:"openpq_cms="+token}:{}),...(body?{"content-type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{})});
try{
  calls.length=0;
  const anon=await onRequest({request:request(false),env});
  assert.equal(anon.status,401);
  assert.equal(calls.length,0,"Anonymous requests must not load CMS data");
  const response=await onRequest({request:request(true),env});
  const result=await response.json();
  assert.equal(response.status,200);
  assert.equal(result.storage,"computed-from-main");
  const keys=result.tasks.map(x=>x.rule_id+"|"+x.entity_id+"|"+x.field);
  assert.equal(new Set(keys).size,keys.length,"Tasks should be deduplicated by record and field");
  assert.ok(result.tasks.some(x=>x.rule_id==="VENUE_COORDINATE_EVIDENCE_INCOMPLETE"&&x.entity_id==="venue_a"&&x.evidence.includes("nguồn kiểm tra tọa độ")));
  assert.ok(result.tasks.some(x=>x.rule_id==="VENUE_COORDINATE_MISSING"&&x.entity_id==="venue_b"));
  assert.ok(result.tasks.some(x=>x.rule_id==="FOOD_ARTICLE_GAP"&&x.entity_id==="food_ghe"));
  assert.ok(result.tasks.some(x=>x.rule_id==="FOOD_PILOT_NO_READY_VENUES"&&x.entity_id===null));
  assert.ok(result.tasks.some(x=>x.rule_id==="FOOD_VENUE_RELATIONSHIPS_NOT_MODELED"&&x.entity_id===null));
  assert.ok(result.tasks.every(x=>x.owner===""&&x.status==="open"&&x.persistence==="computed"));
  assert.match(result.note,/D1 chưa sẵn sàng/);
  const rows={},events=[];
  const db={
    prepare(sql){
      return {sql,values:[],bind(...values){this.values=values;return this},
        async first(){return rows[this.values[0]]||null},
        async all(){return{results:Object.values(rows)}}
      };
    },
    async batch(statements){
      for(const st of statements){
        if(st.sql.startsWith("INSERT INTO cms_quality_work_items")){
          const [task_key,rule_id,entity_id,field,status,owner,due_at,muted_until,note,created_at,updated_at]=st.values;
          rows[task_key]={task_key,rule_id,entity_id,field,status,owner,due_at,muted_until,note,created_at,updated_at};
        }else if(st.sql.startsWith("INSERT INTO cms_quality_audit_events"))events.push(st.values);
      }
      return [];
    }
  };
  env.CMS_DB=db;
  const task=result.tasks.find(x=>x.rule_id==="VENUE_COORDINATE_MISSING");
  const task_key=[task.rule_id,task.entity_id||"",task.field].join("|");
  const claimed=await onRequest({request:request(true,"POST",{task_key,action:"claim"}),env});
  assert.equal(claimed.status,200);
  const due=await onRequest({request:request(true,"POST",{task_key,action:"due",due_at:"2026-10-01"}),env});
  assert.equal(due.status,200);
  const persisted=await onRequest({request:request(true),env});
  const persistedResult=await persisted.json();
  assert.equal(persistedResult.storage,"d1");
  const persistedTask=persistedResult.tasks.find(x=>x.entity_id===task.entity_id&&x.rule_id===task.rule_id);
  assert.equal(persistedTask.status,"in_progress","Setting a due date must preserve task status");
  assert.equal(persistedTask.owner,"kenzuko");
  assert.equal(persistedTask.due_at,"2026-10-01");
  assert.equal(events.length,2);
  assert.equal(events[0][2],"kenzuko");
  assert.equal(events[0][3],"claim");
  assert.equal(events[0][4],"null");
  assert.equal(events[1][3],"due");
  const migration=fs.readFileSync(path.join(process.cwd(),"migrations/d1/0001_cms_quality_work_items.sql"),"utf8");
  const sqlCheck=spawnSync("python3",["-c","import sqlite3,sys; db=sqlite3.connect(':memory:'); db.executescript('CREATE TABLE analytics_sync (source TEXT PRIMARY KEY); CREATE TABLE cms_weather_field_feedback (id TEXT PRIMARY KEY);'); db.executescript(sys.stdin.read()); names={r[0] for r in db.execute(\"SELECT name FROM sqlite_master WHERE type='table'\")}; assert {'analytics_sync','cms_weather_field_feedback','cms_quality_work_items','cms_quality_audit_events'} <= names"],{input:migration,encoding:"utf8"});
  assert.equal(sqlCheck.status,0,sqlCheck.stderr||sqlCheck.stdout);
  console.log("CMS quality queue tests passed: auth, task dedupe, D1 state, due dates, audit and additive SQLite migration.");
}finally{globalThis.fetch=originalFetch}
