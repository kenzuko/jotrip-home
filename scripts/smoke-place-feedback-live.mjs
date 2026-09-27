import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const root="https://cms.openphuquoc.com";
const publicOrigin="https://openphuquoc.com";
const token=(process.env.CF_API_TOKEN||"").trim();
const account=(process.env.CF_ACCOUNT_ID||"").trim();
if(!token||!account)throw Error("Cloudflare D1 credentials missing: feedback smoke cannot verify persistence");
const cfg=JSON.parse(await readFile("wrangler.pages.jsonc","utf8"));
const databaseId=cfg.d1_databases?.find(item=>item.binding==="CMS_DB")?.database_id;
if(!/^[0-9a-f-]{36}$/i.test(databaseId||""))throw Error("CMS D1 ID missing from Pages config");

const fetchChecked=async(url,options={})=>fetch(url,{...options,signal:AbortSignal.timeout(15000)});
const queryD1=async(sql,params=[])=>{
  const response=await fetchChecked("https://api.cloudflare.com/client/v4/accounts/"+encodeURIComponent(account)+"/d1/database/"+encodeURIComponent(databaseId)+"/query",{
    method:"POST",headers:{Authorization:"Bearer "+token,"content-type":"application/json"},
    body:JSON.stringify({sql,params})
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok||data.success!==true||data.result?.[0]?.success===false)
    throw Error("Cloudflare D1 smoke query failed (HTTP "+response.status+")");
  return data.result?.[0]?.results||[];
};
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let reference=null;
try{
  let config;
  for(let attempt=1;attempt<=8;attempt++){
    const response=await fetchChecked(root+"/api/feedback?v="+encodeURIComponent(process.env.GITHUB_SHA||"smoke")+"-"+attempt,{
      headers:{Origin:publicOrigin,"cache-control":"no-cache"}
    });
    if(response.ok&&(response.headers.get("content-type")||"").includes("application/json")){
      config=await response.json();
      if(config?.enabled===true){
        assert.equal(response.headers.get("access-control-allow-origin"),publicOrigin);
        break;
      }
    }
    if(attempt<8)await pause(3000);
  }
  assert.equal(config?.enabled,true,"CMS feedback intake is not enabled after deploy; verify CMS_SESSION_SECRET and CMS_DB");
  const formPage=await fetchChecked(root+"/nearme/?v="+encodeURIComponent(process.env.GITHUB_SHA||"smoke"));
  const pageHtml=await formPage.text();
  assert.ok(formPage.ok&&pageHtml.includes("data-openpq-feedback")&&pageHtml.includes("place-feedback.js"),
    "CMS Near Me must expose correction controls and the shared feedback client");
  const inbox=await fetchChecked(root+"/api/cms/feedback",{headers:{Accept:"application/json"}});
  assert.equal(inbox.status,401,"CMS inbox must deny anonymous requests");
  const options=await fetchChecked(root+"/api/feedback",{
    method:"OPTIONS",headers:{Origin:publicOrigin,"Access-Control-Request-Method":"POST","Access-Control-Request-Headers":"content-type"}
  });
  assert.equal(options.status,204,"Official apex CORS preflight must work");
  assert.equal(options.headers.get("access-control-allow-origin"),publicOrigin);
  const hostile=await fetchChecked(root+"/api/feedback",{
    method:"OPTIONS",headers:{Origin:"https://untrusted.example","Access-Control-Request-Method":"POST"}
  });
  assert.equal(hostile.status,403,"Unknown origins must not be permitted");

  const form=new FormData();
  form.set("issue","other");
  form.set("entity_type","general");
  form.set("entity_id","feedback_smoke_test");
  form.set("entity_label","OpenPQ automated feedback delivery check");
  form.set("details","Controlled release QA report. This record is removed immediately after verification.");
  form.set("source_url",publicOrigin+"/nearme/");
  const submit=await fetchChecked(root+"/api/feedback",{
    method:"POST",headers:{Origin:publicOrigin,Accept:"application/json"},
    body:form
  });
  const receipt=await submit.json().catch(()=>({}));
  assert.equal(submit.status,201,"Public feedback must return receipt 201, got: "+JSON.stringify({status:submit.status,error:receipt.error}));
  assert.equal(submit.headers.get("access-control-allow-origin"),publicOrigin);
  reference=receipt.reference;
  assert.match(reference,/^[0-9a-f-]{36}$/i,"Feedback receipt ID must be a UUID");
  let row;
  for(let attempt=0;attempt<4;attempt++){
    row=(await queryD1("SELECT id, status, entity_id FROM cms_place_feedback WHERE id = ? LIMIT 1",[reference]))[0];
    if(row)break;
    await pause(1000);
  }
  assert.equal(row?.id,reference,"Public report not persisted into the official CMS D1 database");
  assert.equal(row?.status,"new","Submitted report must stay unverified in CMS queue");
  assert.equal(row?.entity_id,"feedback_smoke_test");
  console.log("LIVE FEEDBACK SMOKE PASS: official-origin CORS, anonymous intake, authenticated queue guard, D1 persistence and receipt. Private R2 photos deliberately not enabled by this test.");
}finally{
  if(reference&&/^[0-9a-f-]{36}$/i.test(reference)){
    const removed=await queryD1("DELETE FROM cms_place_feedback WHERE id = ? AND entity_id = ?",[reference,"feedback_smoke_test"]);
    const remaining=await queryD1("SELECT id FROM cms_place_feedback WHERE id = ? LIMIT 1",[reference]);
    assert.equal(remaining.length,0,"Smoke report cleanup failed");
    console.log("LIVE FEEDBACK SMOKE CLEANUP PASS: test report removed; no canonical data changed.",removed.length);
  }
}
