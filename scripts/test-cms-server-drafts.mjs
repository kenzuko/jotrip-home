import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {webcrypto} from "node:crypto";

if(!globalThis.crypto)globalThis.crypto=webcrypto;
const secret="server-draft-test-key",enc=new TextEncoder();
const digest=await webcrypto.subtle.digest("SHA-256",enc.encode(secret));
const key=await webcrypto.subtle.importKey("raw",digest,{name:"AES-GCM"},false,["encrypt"]);
const iv=webcrypto.getRandomValues(new Uint8Array(12));
const payload={login:"kenzuko",accessToken:"test-token",exp:Date.now()+60000};
const cipher=await webcrypto.subtle.encrypt({name:"AES-GCM",iv},key,enc.encode(JSON.stringify(payload)));
const token=Buffer.from(iv).toString("base64url")+"."+Buffer.from(cipher).toString("base64url");

const {onRequest}=await import("../functions/api/cms/drafts.js");
const originalFetch=globalThis.fetch;
let liveRole="editor";
const fetchCalls=[];
globalThis.fetch=async url=>{
  const target=String(url);fetchCalls.push(target);
  if(target.startsWith("https://raw.githubusercontent.com/kenzuko/jotrip-home/main/cms/users.json")){
    return Response.json({users:[{login:"kenzuko",role:liveRole,enabled:true}]});
  }
  throw new Error("Unexpected network request "+target);
};

function mockDb(){
  const drafts=new Map(),revisions=[],audits=[];
  function statement(sql){
    return {sql,values:[],bind(...values){this.values=values;return this},
      async first(){
        if(sql.startsWith("SELECT draft_key,actor,module_id,path,base_sha,data_json,last_revision_id")){
          return drafts.get(this.values[0])||null;
        }
        if(sql.startsWith("SELECT revision_id,draft_key,actor,module_id,path,base_sha,data_json")){
          return revisions.find(x=>x.draft_key===this.values[0]&&x.revision_id===this.values[1])||null;
        }
        throw new Error("Unexpected first SQL: "+sql);
      },
      async all(){
        if(sql.startsWith("SELECT revision_id,base_sha,created_at FROM cms_draft_revisions")){
          const rows=revisions.filter(x=>x.draft_key===this.values[0])
            .sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)))
            .slice(0,20)
            .map(x=>({revision_id:x.revision_id,base_sha:x.base_sha,created_at:x.created_at}));
          return {results:rows};
        }
        throw new Error("Unexpected all SQL: "+sql);
      }
    };
  }
  return{
    drafts,revisions,audits,
    prepare:statement,
    async batch(statements){
      for(const st of statements){
        if(st.sql.startsWith("INSERT INTO cms_draft_revisions")){
          const [revision_id,draft_key,actor,module_id,pathName,base_sha,data_json,created_at]=st.values;
          revisions.push({revision_id,draft_key,actor,module_id,path:pathName,base_sha,data_json,created_at});
        }else if(st.sql.startsWith("INSERT INTO cms_drafts")){
          const [draft_key,actor,module_id,pathName,base_sha,data_json,last_revision_id,last_checkpoint_at,created_at,updated_at]=st.values;
          const prior=drafts.get(draft_key);
          drafts.set(draft_key,{draft_key,actor,module_id,path:pathName,base_sha,data_json,last_revision_id,last_checkpoint_at,
            created_at:prior?.created_at||created_at,updated_at});
        }else if(st.sql.startsWith("INSERT INTO cms_draft_audit")){
          const [event_id,draft_key,actor,action,revision_id,base_sha,created_at]=st.values;
          audits.push({event_id,draft_key,actor,action,revision_id,base_sha,created_at});
        }else if(st.sql.startsWith("DELETE FROM cms_drafts")){
          drafts.delete(st.values[0]);
        }else throw new Error("Unexpected batch SQL: "+st.sql);
      }
      return [];
    }
  };
}

const db=mockDb();
const env={CMS_SESSION_SECRET:secret,CMS_DB:db};
const SHA="a".repeat(40);
function request(method="GET",body=null,{origin="https://cms.openphuquoc.com",cookie=true,pathName="data/content.json"}={}){
  const url="https://cms.openphuquoc.com/api/cms/drafts?path="+encodeURIComponent(pathName);
  const headers={...(cookie?{cookie:"openpq_cms="+token}:{}),...(origin?{origin}:{}),...(body?{"content-type":"application/json"}:{})};
  return new Request(url,{method,headers,...(body?{body:JSON.stringify(body)}:{})});
}

try{
  const anon=await onRequest({request:request("GET",null,{cookie:false}),env});
  assert.equal(anon.status,401);

  const missingDb=await onRequest({request:request(),env:{CMS_SESSION_SECRET:secret}});
  assert.equal(missingDb.status,503);

  const firstData={stories:[{id:"one",title:"Bản 1"}]};
  const first=await onRequest({request:request("POST",{
    action:"save",module_id:"stories",path:"data/content.json",base_sha:SHA,data:firstData
  }),env});
  const firstBody=await first.json();
  assert.equal(first.status,200,JSON.stringify(firstBody));
  assert.equal(firstBody.revision_created,true);
  assert.equal(firstBody.draft.base_sha,SHA);
  assert.deepEqual(firstBody.draft.data,firstData);
  assert.equal(firstBody.history.length,1);
  assert.equal(db.revisions.length,1);
  assert.equal(db.audits.length,1);
  const firstRevision=firstBody.history[0].revision_id;

  const same=await onRequest({request:request("POST",{
    action:"save",module_id:"stories",path:"data/content.json",base_sha:SHA,data:firstData
  }),env});
  const sameBody=await same.json();
  assert.equal(sameBody.unchanged,true);
  assert.equal(db.revisions.length,1,"Identical autosaves must not create revisions");
  assert.equal(db.audits.length,1,"Identical autosaves must not create audit noise");

  const secondData={stories:[{id:"one",title:"Bản 2"}]};
  const second=await onRequest({request:request("POST",{
    action:"save",module_id:"stories",path:"data/content.json",base_sha:SHA,data:secondData
  }),env});
  const secondBody=await second.json();
  assert.equal(second.status,200);
  assert.equal(secondBody.revision_created,false,"Rapid autosave should update canonical draft without checkpoint spam");
  assert.deepEqual(secondBody.draft.data,secondData);
  assert.equal(db.revisions.length,1);
  assert.equal(db.audits.length,2);

  const checkpointData={stories:[{id:"one",title:"Bản 3"}]};
  const checkpoint=await onRequest({request:request("POST",{
    action:"save",module_id:"stories",path:"data/content.json",base_sha:SHA,data:checkpointData,checkpoint:true
  }),env});
  const checkpointBody=await checkpoint.json();
  assert.equal(checkpointBody.revision_created,true);
  assert.equal(db.revisions.length,2);
  assert.equal(checkpointBody.history.length,2);

  const get=await onRequest({request:request(),env});
  const getBody=await get.json();
  assert.equal(get.status,200);
  assert.equal(getBody.storage,"d1");
  assert.deepEqual(getBody.draft.data,checkpointData);
  assert.equal(getBody.history.length,2);

  const restored=await onRequest({request:request("POST",{
    action:"restore",path:"data/content.json",revision_id:firstRevision
  }),env});
  const restoredBody=await restored.json();
  assert.equal(restored.status,200,JSON.stringify(restoredBody));
  assert.equal(restoredBody.restored_from,firstRevision);
  assert.deepEqual(restoredBody.draft.data,firstData);
  assert.equal(db.revisions.length,3,"Restore must append a new checkpoint rather than rewrite history");
  assert.equal(db.audits.at(-1).action,"restore");

  const cleared=await onRequest({request:request("POST",{
    action:"clear",path:"data/content.json"
  }),env});
  const clearedBody=await cleared.json();
  assert.equal(cleared.status,200);
  assert.equal(clearedBody.cleared,true);
  assert.equal(db.drafts.size,0);
  assert.equal(clearedBody.history.length,3,"Clear removes only the active draft, not history");
  assert.equal(db.audits.at(-1).action,"clear");

  liveRole="viewer";
  const viewer=await onRequest({request:request("POST",{
    action:"save",module_id:"stories",path:"data/content.json",base_sha:SHA,data:firstData
  }),env});
  assert.equal(viewer.status,403,"Viewer must not persist drafts");

  liveRole="editor";
  const crossSite=await onRequest({request:request("POST",{
    action:"save",module_id:"stories",path:"data/content.json",base_sha:SHA,data:firstData
  },{origin:"https://openphuquoc.com"}),env});
  assert.equal(crossSite.status,403);

  const unsupported=await onRequest({request:request("POST",{
    action:"save",module_id:"secret",path:"../secret.json",base_sha:SHA,data:{x:1}
  }),env});
  assert.equal(unsupported.status,400);

  assert.ok(fetchCalls.every(x=>x.startsWith("https://raw.githubusercontent.com/kenzuko/jotrip-home/main/cms/users.json")),
    "Saving a server draft must not write to or read mutation endpoints on GitHub");

  const migration=fs.readFileSync(path.join(process.cwd(),"migrations/d1/0007_cms_server_drafts.sql"),"utf8");
  const sqlCheck=spawnSync("python3",["-c",
    "import sqlite3,sys; db=sqlite3.connect(':memory:'); db.executescript('CREATE TABLE existing_table (id TEXT PRIMARY KEY);'); db.executescript(sys.stdin.read()); names={r[0] for r in db.execute(\"SELECT name FROM sqlite_master WHERE type='table'\")}; assert {'existing_table','cms_drafts','cms_draft_revisions','cms_draft_audit'} <= names"
  ],{input:migration,encoding:"utf8"});
  assert.equal(sqlCheck.status,0,sqlCheck.stderr||sqlCheck.stdout);

  console.log("CMS server draft PASS: auth, D1 current draft, dedupe, checkpoints, restore, clear, history and additive migration.");
}finally{
  globalThis.fetch=originalFetch;
}
