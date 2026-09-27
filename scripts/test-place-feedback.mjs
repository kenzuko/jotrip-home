import assert from "node:assert/strict";
import {publicConfig,publicSubmit,adminFeedback,cleanupFeedback} from "../functions/_shared/place-feedback.js";
import {onRequest as publicFeedbackRoute} from "../functions/api/feedback.js";

const records=[],photos=new Map(),translations=new Map();
const db={prepare(query){
  let args=[];
  return {
    bind(...v){args=v;return this;},
    async first(){
      if(query.startsWith("SELECT 1 AS ready"))return {ready:1};
      if(query.startsWith("SELECT COUNT"))return {total:records.filter(x=>x.submit_hash===args[0]&&x.created_at>=args[1]).length};
      if(query.startsWith("SELECT image_key"))return records.find(x=>x.id===args[0])||null;
      if(query.startsWith("SELECT target_locale"))return translations.get(args[0])||null;
      return null;
    },
    async all(){
      if(query.startsWith("SELECT id,image_key"))return {results:records.filter(x=>x.created_at<args[0]).slice(0,100)};
      let rows=records.slice().sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id.localeCompare(a.id));
      const filter=query.includes("WHERE status=?");
      if(filter)rows=rows.filter(x=>x.status===args[0]);
      const offset=Number(args[filter?2:1]||0),limit=Number(args[filter?1:0]||51);
      return {results:rows.slice(offset,offset+limit).map(x=>({id:x.id,issue:x.issue,entity_type:x.entity_type,entity_id:x.entity_id,entity_label:x.entity_label,details:x.details,source_path:x.source_path,created_at:x.created_at,status:x.status,moderator_note:x.moderator_note||"",reviewed_at:x.reviewed_at||null,reviewed_by:x.reviewed_by||null,has_photo:Number(!!x.image_key)}))};
    },
    async run(){
      if(query.startsWith("INSERT INTO cms_translation_feedback")){
        translations.set(args[0],Object.fromEntries(["feedback_id","article_id","target_locale","segment_id","translation_revision","translation_excerpt","source_excerpt","suggested_translation","created_at"].map((key,i)=>[key,args[i]])));
        return {meta:{changes:1}};
      }
      if(query.startsWith("INSERT")){
        records.push(Object.fromEntries(["id","issue","entity_type","entity_id","entity_label","details","source_path",
          "image_key","image_mime","submit_hash","created_at","status"].map((key,i)=>[key,args[i]])));
        return {meta:{changes:1}};
      }
      if(query.startsWith("UPDATE")){
        const row=records.find(x=>x.id===args[4]);
        if(!row)return {meta:{changes:0}};
        Object.assign(row,{status:args[0],moderator_note:args[1],reviewed_at:args[2],reviewed_by:args[3]});
        return {meta:{changes:1}};
      }
      if(query.startsWith("DELETE FROM cms_translation_feedback"))return {meta:{changes:Number(translations.delete(args[0]))}};
      if(query.startsWith("DELETE")){
        const i=records.findIndex(x=>x.id===args[0]&&x.created_at<args[1]);
        if(i<0)return {meta:{changes:0}};
        records.splice(i,1);return {meta:{changes:1}};
      }
      throw Error("Unexpected SQL "+query);
    }
  };
}};
db.batch=async statements=>{for(const statement of statements)await statement.run();return statements.map(()=>({meta:{changes:1}}));};
const r2={
  async put(key,content,metadata){photos.set(key,{body:content,metadata});},
  async get(key){const item=photos.get(key);return item?{body:item.body}:null;},
  async delete(key){photos.delete(key);}
};
const env={CMS_DB:db,FEEDBACK_RATE_SECRET:"local-test-only",FEEDBACK_IMAGES:r2};
function request(issue="location",more={},opts={}){
  const form=new FormData();
  Object.entries({issue,entity_type:"utility",entity_id:"utility_test",entity_label:"Điểm kiểm thử",
    details:"Địa chỉ mới gần khu phố 5.",source_url:"https://cms.openphuquoc.com/nearme/?x=1",...more})
    .forEach(([k,v])=>form.set(k,v));
  const headers={"CF-Connecting-IP":opts.ip||"192.0.2.42"};
  if(opts.origin!==null)headers.origin=opts.origin||"https://cms.openphuquoc.com";
  return new Request("https://cms.openphuquoc.com/api/feedback",{method:"POST",headers,body:form});
}
assert.equal((await (await publicConfig(env)).json()).enabled,true,"D1 + secret ready");
assert.equal((await (await publicConfig({CMS_DB:db})).json()).enabled,false,"Missing secret disables intake");
assert.equal((await publicSubmit(request("location",{}, {origin:"https://evil.example"}),env)).status,403);
assert.equal((await publicSubmit(request("location",{}, {origin:null}),env)).status,403);
assert.equal((await publicSubmit(request("not_valid"),env)).status,400);
assert.equal((await publicSubmit(request("closed",{website:"autofill"}),env)).status,200);
assert.equal(records.length,0,"Honeypot must not store any report");
assert.equal((await publicSubmit(request("location"),{CMS_DB:db})).status,503,"Missing secret fails closed");
assert.equal((await publicSubmit(request("new_place",{entity_id:"",details:"x"}),env)).status,400);
const first=await publicSubmit(request(),env);
assert.equal(first.status,201);
const receipt=await first.json();
assert.ok(receipt.reference);
assert.equal(records.length,1);
assert.equal(records[0].status,"new");
assert.equal(records[0].source_path,"/nearme/");
assert.ok(!("raw_ip" in records[0]));
assert.equal((await publicSubmit(request("location",{source_url:"https://evil.example/nearme/"}),env)).status,201);
assert.equal(records.at(-1).source_path,"/","Cross-origin source URLs must not be trusted");
for(let i=0;i<3;i++)assert.equal((await publicSubmit(request(),env)).status,201);
assert.equal((await publicSubmit(request(),env)).status,429,"Rate limit after five reports per hour");
const imageForm={photo:new Blob([new Uint8Array([137,80,78,71,13,10,26,10,1,2,3])],{type:"image/png"})};
assert.equal((await publicSubmit(request("details",imageForm,{ip:"192.0.2.43"}),env)).status,201);
assert.equal(photos.size,1,"Private R2 receives valid evidence");
assert.equal((await publicSubmit(request("details",{photo:new Blob(["<svg onload=alert(1)>"],{type:"image/png"})},{ip:"192.0.2.44"}),env)).status,415);
for(let i=0;i<51;i++){
  const response=await publicSubmit(request("hours",{entity_label:"Kiểm thử "+i},{ip:"198.51.100."+i}),env);
  assert.equal(response.status,201,"Additional test report "+i);
}
const unauth=async()=>new Response(JSON.stringify({error:"Chưa đăng nhập"}),{status:401});
const viewer=async()=>Response.json({login:"viewer",role:"viewer"});
const editor=async()=>Response.json({login:"editor",role:"editor"});
assert.equal((await adminFeedback(new Request("https://cms.openphuquoc.com/api/cms/feedback"),env,unauth)).status,401);
const firstPage=await adminFeedback(new Request("https://cms.openphuquoc.com/api/cms/feedback?status=new"),env,viewer);
assert.equal(firstPage.status,200);
const page1=await firstPage.json();
assert.equal(page1.items.length,50);
assert.equal(page1.has_more,true);
assert.equal(page1.next_offset,50);
assert.ok(!("submit_hash" in page1.items[0]),"IP hash not exposed in CMS inbox");
const page2=await adminFeedback(new Request("https://cms.openphuquoc.com/api/cms/feedback?status=new&offset=50"),env,editor);
assert.equal((await page2.json()).has_more,false);
assert.equal((await adminFeedback(new Request("https://cms.openphuquoc.com/api/cms/feedback?offset=-2"),env,editor)).status,400);
const patch=(status,note)=>new Request("https://cms.openphuquoc.com/api/cms/feedback",{
  method:"PATCH",headers:{"origin":"https://cms.openphuquoc.com","content-type":"application/json"},
  body:JSON.stringify({id:receipt.reference,status,note})
});
assert.equal((await adminFeedback(patch("reviewing","Kiểm tra thực địa"),env,viewer)).status,403);
assert.equal((await adminFeedback(patch("resolved","x"),env,editor)).status,400,"Terminal action requires reason");
assert.equal((await adminFeedback(patch("reviewing","Kiểm tra thực địa"),env,editor)).status,200);
assert.equal(records[0].status,"reviewing");
assert.equal(records[0].reviewed_by,"editor");
const imageId=records.find(x=>x.image_key).id;
const imageResponse=await adminFeedback(new Request("https://cms.openphuquoc.com/api/cms/feedback/photo?id="+imageId),env,editor,{photo:true});
assert.equal(imageResponse.status,200);
assert.equal(imageResponse.headers.get("cache-control"),"private, no-store");
const future=Date.now()+181*86400000;
const dry=await cleanupFeedback({...env,FEEDBACK_IMAGES:null},future);
assert.equal(dry.skipped,1,"R2 missing must not orphan private images");
assert.equal(records.length,1);
const final=await cleanupFeedback(env,future);
assert.equal(final.deleted,1);
assert.equal(records.length,0);
assert.equal(photos.size,0);

// CMS Pages may reuse the existing session secret with a separate HMAC domain.
const fallbackEnv={...env,FEEDBACK_RATE_SECRET:undefined,CMS_SESSION_SECRET:"test-existing-cms-session"};
assert.equal((await (await publicConfig(fallbackEnv)).json()).enabled,true,"CMS secret fallback works");
const cmsUrl="https://cms.openphuquoc.com/api/feedback";
const getResponse=await publicFeedbackRoute({request:new Request(cmsUrl),env:fallbackEnv});
assert.equal(getResponse.status,200);
assert.equal(getResponse.headers.get("access-control-allow-origin"),null,"No cross-origin headers needed");
assert.equal((await getResponse.json()).enabled,true);
const preflight=await publicFeedbackRoute({request:new Request(cmsUrl,{method:"OPTIONS",headers:{origin:"https://openphuquoc.com"}}),env:fallbackEnv});
assert.equal(preflight.status,405,"Unused apex must not have CORS preflight");
const rejectedApex=await publicFeedbackRoute({request:request("location",{}, {origin:"https://openphuquoc.com",ip:"198.51.100.249"}),env:fallbackEnv});
assert.equal(rejectedApex.status,403,"Inactive apex requests must be rejected");
const sameOriginSubmit=await publicFeedbackRoute({request:request("location",{source_url:"https://cms.openphuquoc.com/nearme/?category=PHARMACY"},{origin:"https://cms.openphuquoc.com",ip:"198.51.100.250"}),env:fallbackEnv});
assert.equal(sameOriginSubmit.status,201);
assert.equal(sameOriginSubmit.headers.get("access-control-allow-origin"),null);
assert.equal(records[0].source_path,"/nearme/","CMS source path is retained without arbitrary query values");
assert.equal(records.length,1,"Rejected origin must not produce any report");
const crossAdmin=new Request("https://cms.openphuquoc.com/api/cms/feedback",{method:"PATCH",headers:{origin:"https://openphuquoc.com","content-type":"application/json"},body:JSON.stringify({id:records[0].id,status:"reviewing",note:"Kiểm chứng"})});
assert.equal((await adminFeedback(crossAdmin,fallbackEnv,editor)).status,403,"CMS state changes remain same-origin only");
console.log("Place feedback QA PASS: readiness, same-origin protection, field validation, anti-spam, D1, pagination, R2, CMS permissions, mandatory resolution note, 180-day cleanup and CMS-secret fallback");
