import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

const src=readFileSync("admin/editor-workflow.js","utf8");
const admin=readFileSync("admin/admin.js","utf8");
const html=readFileSync("admin/index.html","utf8");
new Function(src);new Function(admin);
assert.match(html,/editor-workflow\.js\?v=\d+/);
assert.match(html,/id="editorTools"/);
assert.match(admin,/writeRecordCheckpoints\(info\)/);
assert.match(admin,/checkRemote\(\{force:true\}\)/);
assert.match(admin,/publishInFlight/);

function setup(){
  const values=new Map(),events=new Map(),dialogs=[];
  const storage={get length(){return values.size},key:i=>[...values.keys()][i]??null,
    getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),
    removeItem:k=>values.delete(k)};
  const panel={innerHTML:"",handlers:{},classList:{add(){},remove(){}},
    querySelector(){return null},addEventListener(k,fn){this.handlers[k]=fn},
    removeEventListener(k){delete this.handlers[k]}};
  const document={
    getElementById:id=>id==="editorTools"?panel:id==="ewPreviewDialog"?dialogs[0]||null:null,
    body:{appendChild(){}},
    createElement(tag){
      const el={tagName:tag.toUpperCase(),innerHTML:"",open:false,
        classList:{add(){},remove(){}},querySelector(){return {onclick:null}},
        showModal(){this.open=true},close(){this.open=false},
        setAttribute(k){if(k==="open")this.open=true},remove(){},click(){}};
      if(tag==="dialog")dialogs.push(el);return el;
    }
  };
  const window={addEventListener:(k,f)=>events.set(k,f),
    removeEventListener:k=>events.delete(k)};
  const alerts=[];
  vm.runInNewContext(src,{window,document,localStorage:storage,
    crypto:{randomUUID:()=>"test-tab"},Blob,URL,location:{origin:"https://cms.openphuquoc.com"},
    confirm:()=>true,alert:m=>alerts.push(m),Intl,Date,Math,JSON,Map,Set,Number,
    String,Array,Object,encodeURIComponent,decodeURIComponent});
  const base={stories:[{id:"hat-tieu",title:"Hạt tiêu Phú Quốc",category:"CHẤT ĐẢO",
    dek:"Đoạn dẫn",intro:"Mở bài",image:"/assets/media/pepper.jpg",
    sections:[{heading:"Người trồng",body:"Nắng và mưa"}],sources:[{label:"Nguồn"}]}]};
  const current=JSON.parse(JSON.stringify(base));
  let remote={path:"data/content.json",sha:"goodsha",complete:true,conflicts:[]};
  let called=0,dirty=0,rendered=0;
  const props={login:"tester",module:"stories",modulePath:"data/content.json",
    sha:"goodsha",writable:true,baseData:base,getCurrent:()=>current,
    api:async()=>{called++;return remote;},onDirty(){dirty++},onRender(){rendered++}};
  return{wf:window.OPQEditorWorkflow,values,storage,events,dialogs,panel,alerts,base,
    current,props,setRemote:v=>remote=v,calls:()=>called,dirty:()=>dirty,rendered:()=>rendered};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
{
  const h=setup(),wf=h.wf;
  wf.start(h.props);await settle();
  assert.equal(wf.canSubmit(),true);
  assert.equal(h.calls(),1);
  h.current.stories[0].title="Hạt tiêu đang soạn";
  h.current.stories[0].sections[0].body='<script>alert("unsafe")</script>';
  const payload={login:"tester",module:"stories",sha:"goodsha",
    data:h.current,baseData:h.base};
  assert.equal(wf.writeModuleDraft(payload).ok,true);
  assert.equal(wf.writeRecordCheckpoints(payload).saved,1);
  const one=wf.records("tester").items[0];
  assert.equal(one.record.title,"Hạt tiêu đang soạn");
  wf.renderPanel();
  assert.match(h.panel.innerHTML,/Bản nháp riêng từng bài \(1\)/);
  assert.match(h.panel.innerHTML,/data-ew-restore/);
  wf.previewArticle(0);
  assert.equal(h.dialogs[0].open,true);
  assert.match(h.dialogs[0].innerHTML,/Hạt tiêu đang soạn/);
  assert.match(h.dialogs[0].innerHTML,/&lt;script&gt;/);
  assert.doesNotMatch(h.dialogs[0].innerHTML,/<script>/);
  assert.equal(h.calls(),1,"preview must never use live APIs");
  h.current.stories[0].title="Khác bản nháp";
  const target={getAttribute:n=>n==="data-ew-restore"?one.key:null,
    hasAttribute:n=>n==="data-ew-restore"};
  h.panel.handlers.click({target:{closest:()=>target},preventDefault(){}});
  assert.equal(h.current.stories[0].title,"Hạt tiêu đang soạn");
  assert.equal(h.dirty(),1);assert.equal(h.rendered(),1);
  h.setRemote({sha:"goodsha",complete:true,
    conflicts:[{number:33,title:"CMS: đề xuất khác",url:"javascript:alert(1)"}]});
  assert.equal((await wf.checkRemote({force:true})).ok,false);
  assert.equal(wf.canSubmit(),false);
  assert.match(h.panel.innerHTML,/pull\/33/);
  assert.doesNotMatch(h.panel.innerHTML,/javascript:alert/);
  h.setRemote({sha:"new-sha",complete:true,conflicts:[]});
  await wf.checkRemote({force:true});
  assert.equal(wf.canSubmit(),false,"new GitHub SHA blocks submission");
  h.setRemote({sha:"goodsha",complete:true,conflicts:[]});
  await wf.checkRemote({force:true});
  assert.equal(wf.canSubmit(),true);
  const other={sha:"goodsha",data:h.base,at:Date.now()+1000,tab:"other-tab"};
  h.storage.setItem("openpq-cms-draft:tester:stories",JSON.stringify(other));
  h.events.get("storage")({storageArea:h.storage,key:"openpq-cms-draft:tester:stories",
    newValue:JSON.stringify(other)});
  assert.equal(wf.hasConflict(),true);
  assert.equal(wf.canSubmit(),false);
  assert.equal(wf.writeModuleDraft(payload).archived,true);
  assert.equal(h.storage.getItem("openpq-cms-draft:tester:stories"),JSON.stringify(other));
  assert.ok([...h.values.keys()].some(x=>x.startsWith("openpq-cms-stale:tester:stories:")));
  wf.stop();
  assert.equal(h.events.has("storage"),false);
  assert.equal(h.panel.handlers.click,undefined);
}
{
  const h=setup();
  h.current.stories[0].title="Bản lưu của biên tập viên";
  h.wf.writeRecordCheckpoints({login:"tester",module:"stories",sha:"goodsha",
    data:h.current,baseData:h.base});
  h.wf.start({...h.props,writable:false});await settle();
  assert.match(h.panel.innerHTML,/Tải JSON/);
  assert.doesNotMatch(h.panel.innerHTML,/data-ew-restore/);
  h.wf.previewArticle(0);
  assert.equal(h.dialogs[0].open,true,"viewer can preview but not restore");
  h.wf.stop();
}
console.log("PASS CMS editor V1.3: per-record backups, explicit recovery, local XSS-safe preview, role guard, remote conflicts, tab collision");