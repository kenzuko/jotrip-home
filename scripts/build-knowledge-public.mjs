import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const sourcePath=path.join(root,"data","knowledge","objects.json");
const outPath=path.join(root,"data","views","knowledge-public.json");
const payload=JSON.parse(fs.readFileSync(sourcePath,"utf8"));

function routeFor(o){
  return "/guide/article.html?id="+encodeURIComponent(o.topic_id);
}

const objects=(payload.objects||[])
  .filter(o=>o.status==="READY_PUBLIC"&&o.public_ready===true)
  .map(o=>({
    topic_id:o.topic_id,
    number:o.number,
    title:o.title,
    topic_type:o.topic_type,
    story_type:o.story_type,
    canonical_entity_id:o.canonical_entity_id||null,
    related_entity_ids:o.related_entity_ids||[],
    route:routeFor(o),
    editorial:{
      short_summary:o.editorial?.short_summary||"",
      practical:o.editorial?.practical||"",
      expectation_vs_reality:o.editorial?.expectation_vs_reality||"",
      before_you_go:o.editorial?.before_you_go||[],
      curiosity_questions:o.editorial?.curiosity_questions||[]
    },
    updated_at:o.updated_at||payload.updated_at||null
  }));

if(objects.some(o=>!o.topic_id||!o.editorial.short_summary||!o.editorial.practical||!o.editorial.before_you_go.length))throw new Error("Incomplete public knowledge article");
const raw=JSON.stringify(objects);
if(/https?:\/\//i.test(raw)) throw new Error("Public knowledge view contains an external URL");
if(/"research"\s*:|"sources"\s*:/i.test(raw)) throw new Error("Public knowledge view leaked research/source fields");

fs.writeFileSync(outPath,JSON.stringify({
  schema_version:"1.0",
  generated_at:new Date().toISOString(),
  count:objects.length,
  objects
},null,2)+"\n");

console.log("Public knowledge view:",objects.length,"objects");
