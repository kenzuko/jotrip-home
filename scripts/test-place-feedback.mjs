import assert from "node:assert/strict";
import {publicConfig,publicSubmit,adminFeedback} from "../functions/_shared/place-feedback.js";

const records=[];
const db={prepare(query){
  let args=[];
  return {
    bind(...values){args=values;return this;},
    async first(){
      if(query.startsWith("SELECT COUNT"))return {total:records.filter(x=>x.submit_hash===args[0]&&x.created_at>=args[1]).length};
      if(query.startsWith("SELECT image_key")){const row=records.find(x=>x.id===args[0]);return row||null;}
      return null;
    },
    async all(){
      let rows=records;
      if(query.includes("WHERE status=?"))rows=rows.filter(x=>x.status===args[0]);
      return {results:rows.map(x=>({id:x.id,issue:x.issue,entity_id:x.entity_id,entity_label:x.entity_label,
        entity_type:x.entity_type,details:x.details,source_path:x.source_path,has_photo:Number(!!x.image_key),
        created_at:x.created_at,status:x.status,moderator_note:x.moderator_note||""})).slice(0,50)};
    },
    async run(){
      if(query.startsWith("INSERT")){
        records.push(Object.fromEntries(["id","issue","entity_type","entity_id","entity_label","details","source_path",
          "image_key","image_mime","submit_hash","created_at","status"].map((name,i)=>[name,args[i]])));
        return {meta:{changes:1}};
      }
      if(query.startsWith("UPDATE")){
        const row=records.find(x=>x.id===args[4]);
        if(!row)return {meta:{changes:0}};
        Object.assign(row,{status:args[0],moderator_note:args[1],reviewed_at:args[2],reviewed_by:args[3]});
        return {meta:{changes:1}};
      }
      throw Error("Unexpected SQL "+query);
    }
  };
}};
const photos=new Map();
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
  return new Request("https://cms.openphuquoc.com/api/feedback",{
    method:"POST",headers:{"origin":opts.origin||"https://cms.openphuquoc.com",
      "CF-Connecting-IP":opts.ip||"192.0.2.42"},body:form
  });
}
assert.equal((await publicConfig(env)).status,200);
assert.equal((await publicSubmit(request("location",{}, {origin:"https://evil.example"}),env)).status,403);
assert.equal((await publicSubmit(request("not_valid"),env)).status,400);
assert.equal((await publicSubmit(request("closed",{website:"autofill"}),env)).status,200);
assert.equal(records.length,0,"Honeypot must not store any report");
assert.equal((await publicSubmit(request("location"),{CMS_DB:db})).status,503,"No secret must fail closed");
const first=await publicSubmit(request(),env);
assert.equal(first.status,201);
const receipt=await first.json();
assert.ok(receipt.reference);
assert.equal(records.length,1);
assert.equal(records[0].status,"new");
assert.equal(records[0].source_path,"/nearme/?x=1");
assert.ok(!("raw_ip" in records[0]));
for(let i=0;i<4;i++)assert.equal((await publicSubmit(request(),env)).status,201);
assert.equal((await publicSubmit(request(),env)).status,429,"Rate limit after five in one hour");
const imageForm={photo:new Blob([new Uint8Array([137,80,78,71,13,10,26,10,1,2,3])],{type:"image/png"})};
const imgReq=request("details",imageForm,{ip:"192.0.2.43"});
const imageResult=await publicSubmit(imgReq,env);
assert.equal(imageResult.status,201);
assert.equal(photos.size,1,"Private R2 must receive valid image");
const badImage=new Blob(["<svg onload=alert(1)>"],{type:"image/png"});
assert.equal((await publicSubmit(request("details",{photo:badImage},{ip:"192.0.2.44"}),env)).status,415);
const unauth=async()=>new Response(JSON.stringify({error:"Chưa đăng nhập"}),{status:401});
assert.equal((await adminFeedback(new Request("https://cms.openphuquoc.com/api/cms/feedback"),env,unauth)).status,401);
const viewer=async()=>Response.json({login:"viewer",role:"viewer"});
const editor=async()=>Response.json({login:"editor",role:"editor"});
const listing=await adminFeedback(new Request("https://cms.openphuquoc.com/api/cms/feedback?status=new"),env,viewer);
assert.equal(listing.status,200);
const items=(await listing.json()).items;
assert.equal(items.length,6);
assert.ok(!("submit_hash" in items[0]),"Never disclose IP hash to CMS UI");
const patch=new Request("https://cms.openphuquoc.com/api/cms/feedback",{
  method:"PATCH",headers:{"origin":"https://cms.openphuquoc.com","content-type":"application/json"},
  body:JSON.stringify({id:receipt.reference,status:"reviewing",note:"Kiểm tra thực địa"})
});
assert.equal((await adminFeedback(patch.clone(),env,viewer)).status,403);
assert.equal((await adminFeedback(patch,env,editor)).status,200);
assert.equal(records[0].status,"reviewing");
assert.equal(records[0].reviewed_by,"editor");
const imageId=records.find(x=>x.image_key).id;
const imageResponse=await adminFeedback(new Request("https://cms.openphuquoc.com/api/cms/feedback/photo?id="+imageId),env,editor,{photo:true});
assert.equal(imageResponse.status,200);
assert.equal(imageResponse.headers.get("cache-control"),"private, no-store");
console.log("Place feedback QA PASS: validation, anti-spam, D1 intake, R2 evidence, CMS roles and review states");
