import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

const app=readFileSync("cano/app.js","utf8");
const html=readFileSync("cano/index.html","utf8");
const local=JSON.parse(readFileSync("data/cano-history.json","utf8"));
assert.ok(local.events.some(x=>x.date==="2026-09-27"&&x.state==="RUNNING"),"Offline CMS fallback must retain Sep 27 confirmation");
new vm.Script(app,{filename:"cano/app.js"});
const start=app.indexOf("function mergeHistory(base,remote)");
const end=app.indexOf("function renderHistory",start);
assert.ok(start>=0&&end>start,"cano history merge must exist");
const sandbox={dayVN:()=>"2026-09-28"};
vm.runInNewContext(app.slice(start,end)+";globalThis.mergeHistory=mergeHistory",sandbox);
const base={events:[
 {date:"2026-09-02",state:"SUSPENDED",label:"Earlier confirmed stop"},
 {date:"2026-09-27",state:"SUSPENDED",label:"Outdated local copy"}
]};
const remote={schema_version:"1.0",category:"cano",events:[
 {date:"2026-09-27",state:"RUNNING",label:"Confirmed by project owner"},
 {date:"2026-09-29",state:"RUNNING",label:"Future - must not appear"},
 {date:"2026-09-26",state:"FIELD_REQUIRED",label:"Not confirmed"}
]};
const merged=sandbox.mergeHistory(base,remote);
assert.equal(merged.events.length,2,"Only confirmed history through today is visible");
assert.equal(merged.events[1].date,"2026-09-27");
assert.equal(merged.events[1].state,"RUNNING","Canonical confirmation overrides old static date");
assert.equal(sandbox.mergeHistory(base,null).events.length,2,"Static history remains available offline");
assert.equal(sandbox.mergeHistory(base,{category:"other",schema_version:"1.0",events:remote.events}).events[1].state,"SUSPENDED","Reject unrelated sources");
assert.match(app,/Promise\.allSettled/,"Failure of history source must not hide live status");
assert.match(app,/HISTORY_LIVE|ARCHIVE/,"Canonical history source must be referenced");
assert.match(html,/id="historyMeta"/,"Public page must expose archive freshness");
assert.match(html,/app\.js\?v=5/,"Public page must load the updated script");
console.log("PASS: canoe history merging, date safety, offline fallback and CMS wiring");
