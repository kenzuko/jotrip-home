import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

const source=readFileSync("admin/control-room.js","utf8");
const admin=readFileSync("admin/admin.js","utf8");
const html=readFileSync("admin/index.html","utf8");
new Function(source);
new Function(admin);
assert.match(html,/control-room\.css\?v=\d+/);
assert.match(html,/control-room\.js\?v=\d+/);
assert.match(admin,/selectModule\(first\?first\.id:"dashboard"\)/);
assert.match(admin,/if\(!saveDraftNow\(\)\)/);
assert.match(admin,/requestId!==moduleRequestId/);
assert.match(admin,/outdatedDraft=true/);
assert.match(admin,/Đã tạo đề xuất PR/);
assert.match(html,/aria-controls="moduleNav"/);
assert.match(html,/aria-label="Duyệt website trên miền CMS để chỉnh sửa nội dung"/);
assert.match(admin,/NAV_HINTS/);
assert.match(admin,/aria-expanded/);

function harness(role="editor",qualityError=false,qualityData=null){
  const storageData={
    "openpq-cms-draft:tester:stories":JSON.stringify({data:{title:"Một bài viết"},sha:"old",at:"2026-09-27T08:00:00+07:00"})
  };
  const localStorage={
    get length(){return Object.keys(storageData).length},
    key(i){return Object.keys(storageData)[i]??null},
    getItem(k){return storageData[k]??null}
  };
  const host={
    innerHTML:"",
    searchValue:"",
    querySelector(selector){return selector==="[data-cr-search]"?{value:this.searchValue}:null},
    events:{},
    addEventListener(event,handler){this.events[event]=handler},
    removeEventListener(event){delete this.events[event]}
  };
  const requests=[];
  const fetch=async (url,options)=>{
    requests.push({url,method:options?.method||"GET"});
    if(url.includes("/quality")&&qualityError){
      return {ok:false,status:503,json:async()=>({error:"Nguồn dữ liệu chưa sẵn sàng"})};
    }
    if(url.includes("/quality")){
      return {ok:true,status:200,json:async()=>(qualityData||{
        computed_at:"2026-09-27T09:20:00+07:00",
        tasks:[{
          rule_id:"VENUE_SOURCE_MISSING",
          entity_id:"place_test",field:"source_ref",surface:"Địa điểm",
          severity:"high",status:"open",evidence:"Thiếu <nguồn> & chưa xác minh"
        }]
      })};
    }
    return {ok:true,status:200,json:async()=>({
      items:[{number:21,title:"CMS: bài viết mới",draft:false,updated_at:"2026-09-27T08:45:00+07:00"}]
    })};
  };
  const window={};
  vm.runInNewContext(source,{window,fetch,localStorage,AbortController,Intl,Date,URL,encodeURIComponent,Number,String,Map,Set,Array,Object,JSON,Promise},{filename:"admin/control-room.js"});
  const modules=[
    {id:"stories",label:"Bài viết",read:["admin","editor"]},
    {id:"venues",label:"Địa điểm",read:["admin","editor","operator"]},
    {id:"foods",label:"Món ăn",read:["admin","editor"]},
    {id:"analytics",label:"Analytics",read:["admin"]}
  ];
  const jumps=[];
  window.OPQControlRoom.mount({host,role,login:"tester",modules,onNavigate:id=>jumps.push(id)});
  return {host,requests,jumps,window};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
{
  const h=harness();
  await settle();
  assert.match(h.host.innerHTML,/Cần kiểm chứng/);
  assert.match(h.host.innerHTML,/Thiếu &lt;nguồn&gt; &amp; chưa xác minh/);
  assert.match(h.host.innerHTML,/index\.html\?module=venues&amp;record=place_test&amp;field=source_ref/);
  assert.match(h.host.innerHTML,/Nháp trên thiết bị/);
  assert.match(h.host.innerHTML,/Lưu trên trình duyệt/);
  assert.doesNotMatch(h.host.innerHTML,/data-cr-module="analytics"/);
  assert.match(h.host.innerHTML,/data-cr-filter="priority"/);
  assert.match(h.host.innerHTML,/aria-pressed="true"/);
  h.host.events.click({
    target:{closest(selector){return selector==="[data-cr-filter]"?{getAttribute(){return "priority"}}:null}},
    preventDefault(){}
  });
  assert.match(h.host.innerHTML,/aria-pressed="true">Ưu tiên/);
  h.host.events.click({
    target:{closest(selector){return selector==="[data-cr-filter]"?{getAttribute(){return "progress"}}:null}},
    preventDefault(){}
  });
  assert.match(h.host.innerHTML,/Không có việc khớp bộ lọc./);
  assert.deepEqual(h.requests.map(item=>item.method),["GET","GET"]);
  assert.deepEqual(h.requests.map(item=>item.url),["/api/cms/quality","/api/cms/reviews"]);
  h.host.events.click({
    target:{closest(selector){return selector==="[data-cr-module]"?{getAttribute(){return "stories"}}:null}},
    preventDefault(){}
  });
  assert.deepEqual(h.jumps,["stories"]);
  h.window.OPQControlRoom.unmount();
  assert.equal(h.host.events.click,undefined);
  assert.equal(h.host.events.keydown,undefined);
}
{
  const h=harness("admin",true);
  await settle();
  assert.match(h.host.innerHTML,/Một số nguồn chưa tải được/);
  assert.match(h.host.innerHTML,/Không coi số liệu thiếu là 0/);
  assert.match(h.host.innerHTML,/Nguồn dữ liệu chưa sẵn sàng/);
  assert.match(h.host.innerHTML,/data-cr-module="analytics"/);
  assert.match(h.host.innerHTML,/CMS: bài viết mới/);
  assert.doesNotMatch(h.host.innerHTML,/<strong>0<\/strong><small>Chưa đọc được nguồn/);
  h.window.OPQControlRoom.unmount();
}
{
  const mockWindow={},calls=[];
  const host={innerHTML:"",addEventListener(){},removeEventListener(){},querySelectorAll(){return []}};
  vm.runInNewContext(source,{
    window:mockWindow,fetch:()=>{calls.push("unexpected");throw Error("Preview must not call a live API");},
    localStorage:{length:0,key(){return null},getItem(){return null}},
    AbortController,Intl,Date,URL,encodeURIComponent,Number,String,Map,Set,Array,Object,JSON,Promise
  },{filename:"admin/control-room.js"});
  mockWindow.OPQControlRoom.mount({
    host,role:"admin",login:"visual-demo",modules:[{id:"analytics",label:"Analytics",read:["admin"]}],
    previewData:{quality:{tasks:[]},reviews:{items:[]}},onNavigate(){}
  });
  assert.match(host.innerHTML,/Dữ liệu minh họa/);
  assert.deepEqual(calls,[],"static preview attempted a live fetch");
  mockWindow.OPQControlRoom.unmount();
}

{
  // D1-backed owner + due-date triage and diacritic-safe local search.
  const tasks=Array.from({length:8},(_,i)=>({
    rule_id:i===0?"FOOD_ARTICLE_GAP":"VENUE_SOURCE_MISSING",
    entity_id:i===0?"dish_01":"venue_"+i,field:i===0?"legacy_id":"source_ref",
    surface:i===0?"Cẩm nang món ăn":"Địa điểm",
    severity:i===0?"high":"medium",
    status:i===1?"in_progress":"open",
    owner:i===1?"tester":"",
    due_at:i===1?"2020-01-01":null,
    evidence:i===1?"Bãi Sao đang ACTIVE nhưng thiếu nguồn":
      i===0?"Bún quậy có thực thể món":"Bãi "+i+" đang ACTIVE nhưng thiếu nguồn"
  }));
  const h=harness("editor",false,{
    storage:"d1",computed_at:"2026-09-27T09:20:00+07:00",tasks
  });
  await settle();
  assert.match(h.host.innerHTML,/data-cr-filter="mine"/);
  assert.match(h.host.innerHTML,/data-cr-filter="late"/);
  assert.match(h.host.innerHTML,/cr-task-overdue/);
  assert.match(h.host.innerHTML,/module=foods&amp;record=dish_01&amp;field=legacy_id/);
  assert.match(h.host.innerHTML,/data-cr-more/);
  const fire=(selector,value)=>h.host.events.click({
    target:{closest(q){return q===selector?{getAttribute(){return value}}:null}},
    preventDefault(){}
  });
  fire("[data-cr-filter]","mine");
  assert.match(h.host.innerHTML,/Bãi Sao/);
  assert.doesNotMatch(h.host.innerHTML,/Bãi 3 đang ACTIVE/);
  fire("[data-cr-filter]","late");
  assert.match(h.host.innerHTML,/Quá hạn/);
  fire("[data-cr-filter]","all");
  fire("[data-cr-more]","");
  assert.doesNotMatch(h.host.innerHTML,/data-cr-more/);
  h.host.searchValue="bai sao";
  fire("[data-cr-search-submit]","");
  assert.match(h.host.innerHTML,/Bãi Sao/);
  assert.doesNotMatch(h.host.innerHTML,/Bãi 3 đang ACTIVE/);
  fire("[data-cr-search-clear]","");
  assert.match(h.host.innerHTML,/Bãi 3 đang ACTIVE/);
  assert.deepEqual(h.requests.map(x=>x.method),["GET","GET"]);
  h.window.OPQControlRoom.unmount();
}
{
  // No D1: do not misrepresent unknown assignment and deadlines as zero.
  const h=harness("admin",false,{storage:"computed-from-main",tasks:[]});
  await settle();
  assert.match(h.host.innerHTML,/data-cr-filter="mine"[^>]*disabled/);
  assert.match(h.host.innerHTML,/Chưa có trạng thái phân công/);
  h.window.OPQControlRoom.unmount();
}
console.log("PASS: CMS Control Room syntax, permissions, draft, queues, escaping, source degradation and navigation");
// V1.3: run safety and preview tests in the existing CMS-only QA job.
await import("./test-cms-editor-workflow.mjs");
await import("./test-cms-story-desk.mjs");
await import("./test-cms-story-composer.mjs");
await import("./test-cms-inline-edit.mjs");
await import("./test-cms-inline-food.mjs");
await import("./test-cms-direct-save.mjs");
await import("./test-cms-edit-state.mjs");

// Admin V2: shared shell, workflow filters, role-aware switcher and D1 regression.
await import("./test-cms-admin-v2.mjs");
await import("./test-cms-task-center.mjs");
await import("./test-cms-quality.mjs");
