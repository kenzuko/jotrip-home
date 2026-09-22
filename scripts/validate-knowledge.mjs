import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const backlogPath=path.join(root,"data","knowledge","backlog.json");
const objectsPath=path.join(root,"data","knowledge","objects.json");

const errors=[];
const backlog=JSON.parse(fs.readFileSync(backlogPath,"utf8"));
const objectsPayload=JSON.parse(fs.readFileSync(objectsPath,"utf8"));
const topics=backlog.topics||[];
const objects=objectsPayload.objects||[];

if(topics.length!==150) errors.push("knowledge backlog must contain exactly 150 topics, got "+topics.length);

const topicIds=new Set();
const numbers=new Set();
for(const t of topics){
  if(!t.topic_id)errors.push("knowledge topic missing topic_id");
  if(topicIds.has(t.topic_id))errors.push("duplicate knowledge topic_id: "+t.topic_id);
  topicIds.add(t.topic_id);
  if(numbers.has(t.number))errors.push("duplicate knowledge number: "+t.number);
  numbers.add(t.number);
  if(!t.title||!t.topic_type||!t.status)errors.push((t.topic_id||t.number)+": incomplete backlog metadata");
}

const backlogById=new Map(topics.map(t=>[t.topic_id,t]));
const objectIds=new Set();
for(const o of objects){
  if(!topicIds.has(o.topic_id))errors.push("knowledge object not found in backlog: "+o.topic_id);
  const topic=backlogById.get(o.topic_id);
  if(topic&&(topic.status!==o.status||Boolean(topic.public_ready)!==Boolean(o.public_ready)))errors.push(o.topic_id+": backlog/public state mismatch");
  if(o.status==="READY_PUBLIC"&&o.public_ready!==true)errors.push(o.topic_id+": READY_PUBLIC must have public_ready true");
  if(objectIds.has(o.topic_id))errors.push("duplicate knowledge object: "+o.topic_id);
  objectIds.add(o.topic_id);
  if(o.status==="READY_INTERNAL"||o.status==="READY_PUBLIC"){
    if(!o.editorial?.short_summary)errors.push(o.topic_id+": ready object missing short_summary");
    if(!o.editorial?.practical)errors.push(o.topic_id+": ready object missing practical");
    if(!o.editorial?.expectation_vs_reality)errors.push(o.topic_id+": ready object missing expectation_vs_reality");
    if(!Array.isArray(o.editorial?.before_you_go)||!o.editorial.before_you_go.length)errors.push(o.topic_id+": ready object missing before_you_go");
    if(!Array.isArray(o.research?.claims)||!o.research.claims.length)errors.push(o.topic_id+": ready object missing research claims");
    if(!Array.isArray(o.research?.sources)||!o.research.sources.length)errors.push(o.topic_id+": ready object missing internal sources");
  }
  if(o.status!=="READY_PUBLIC"&&o.public_ready===true)errors.push(o.topic_id+": public_ready true before READY_PUBLIC");
  const publicText=JSON.stringify(o.editorial||{});
  if(/https?:\/\//i.test(publicText))errors.push(o.topic_id+": source URL leaked into editorial/public copy");
}

for(const t of topics.filter(x=>x.status==="READY_INTERNAL"||x.status==="READY_PUBLIC")){
  if(!objectIds.has(t.topic_id))errors.push(t.topic_id+": backlog says ready but object is missing");
}

if(errors.length){
  for(const e of errors)console.error("ERROR",e);
  process.exit(1);
}

console.log("Knowledge validation OK:",topics.length,"topics,",objects.length,"enriched objects,",topics.filter(x=>x.status==="READY_INTERNAL").length,"ready internal,",topics.filter(x=>x.status==="READY_PUBLIC").length,"ready public");
