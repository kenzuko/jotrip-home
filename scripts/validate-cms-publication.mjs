import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const source=JSON.parse(fs.readFileSync(path.join(root,"data/knowledge/objects.json"),"utf8"));
const view=JSON.parse(fs.readFileSync(path.join(root,"data/views/knowledge-public.json"),"utf8"));
const errors=[];

const ready=(source.objects||[]).filter(o=>o.status==="READY_PUBLIC"&&o.public_ready===true);
const expectedIds=ready.map(o=>o.topic_id);
const actual=view.objects||[];
const publishedIds=actual.map(o=>o.topic_id);

function duplicates(values){
  const seen=new Set();
  return values.filter(id=>seen.has(id)||!seen.add(id));
}
function sameIds(a,b){
  return a.length===b.length&&a.every((id,i)=>id===b[i]);
}
function verify(label,data){
  const ids=(data.objects||[]).map(o=>o.topic_id);
  if(data.count!==ids.length) errors.push(label+": declared count differs from objects.length");
  if(!sameIds([...expectedIds].sort(),[...ids].sort())) errors.push(label+": published topic IDs differ from READY_PUBLIC source IDs");
  if(duplicates(ids).length) errors.push(label+": duplicate published topic IDs");
  const serialized=JSON.stringify(data);
  if(/"research"\s*:|"sources"\s*:/.test(serialized)) errors.push(label+": private research or source fields leaked");
  for(const item of data.objects||[]){
    if(!item.topic_id||!item.editorial?.short_summary||!item.editorial?.practical||!item.editorial?.before_you_go?.length){
      errors.push(label+": incomplete article "+(item.topic_id||"(missing id)"));
    }
  }
}

if(!ready.length) errors.push("No READY_PUBLIC articles");
if(duplicates(expectedIds).length) errors.push("Duplicate READY_PUBLIC topic IDs");
verify("source public view",view);

const distPath=path.join(root,"dist/data/views/knowledge-public.json");
if(fs.existsSync(distPath)){
  try{verify("Cloudflare bundle",JSON.parse(fs.readFileSync(distPath,"utf8")))}
  catch(error){errors.push("Cloudflare bundle cannot be parsed: "+error.message)}
}

if(errors.length){
  for(const error of errors) console.error("CMS PUBLICATION ERROR",error);
  process.exit(1);
}

if(process.argv.includes("--count")) process.stdout.write(String(ready.length));
else console.log("CMS publication validation OK:",ready.length,"ready/public articles, no private fields or missing IDs");
