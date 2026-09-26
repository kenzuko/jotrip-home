import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
const payload=JSON.parse(fs.readFileSync(path.join(root,"data/knowledge/objects.json"),"utf8"));
const visual=JSON.parse(fs.readFileSync(path.join(root,"data/visual-context.json"),"utf8"));
const out=path.join(root,"data/views/knowledge-public.json");
// Reuse only previously approved image records already in the site's visual catalog.
const overrides={
 "knowledge_002_duong-dong":{source:"stories",key:"duong-dong-sau-5-gio",context:true},
 "knowledge_004_an-thoi":{source:"places",key:"activity_tour_3_islands",context:true},
 "knowledge_035_sao-bien-rach-vem":{source:"places",key:"place_rach_vem"},
 "knowledge_050_hoang-hon-phu-quoc":{source:"nature",key:"phu-quoc-sunset"},
 "knowledge_131_sunset-watching":{source:"nature",key:"phu-quoc-sunset"},
 "knowledge_137_visit-fish-sauce-house-pepper-farm":{both:["place_fish_sauce_house","place_pepper_garden"]}
};
const imagesFor=o=>{
 const over=overrides[o.topic_id];
 let all=visual.knowledge?.[o.topic_id]?.images?.filter(x=>x?.url)||[];
 if(all.length) { /* A reviewed article-specific photo takes priority. */ }
 else if(over?.both)all=over.both.flatMap(key=>visual.places?.[key]?.images||[]);
 else if(over)all=visual[over.source]?.[over.key]?.images||[];
 else if(o.canonical_entity_id?.startsWith("food_"))all=visual.food?.[o.canonical_entity_id.slice(5)]?.images||[];
 else if(o.canonical_entity_id)all=visual.places?.[o.canonical_entity_id]?.images||[];
 return all.filter(x=>x?.url && (/^\/assets\/(?:media|uploads|photos)\//.test(x.url)||/^https:\/\/(?:commons\.wikimedia\.org|visitphuquoc\.com\.vn)\//.test(x.url))).slice(0,3)
 .map(x=>({url:x.url,alt:String(x.alt||o.title),caption:String(x.caption||""),credit:String(x.source_label||"").replace(/^Ảnh:\s*/i,""),scope:over?.context?"context":String(x.scope||"context"),source_url:x.source_url||null,license:x.license||null,license_url:x.license_url||null}));
};
const objects=(payload.objects||[]).filter(o=>o.status==="READY_PUBLIC"&&o.public_ready===true).map(o=>({
 topic_id:o.topic_id,number:o.number,title:o.title,topic_type:o.topic_type,story_type:o.story_type,
 canonical_entity_id:o.canonical_entity_id||null,related_entity_ids:o.related_entity_ids||[],
 links:(o.public_links||[]).map(x=>({label:String(x.label||""),url:String(x.url||"")})),
 route:"/guide/article.html?id="+encodeURIComponent(o.topic_id),media:{images:imagesFor(o)},
 editorial:{short_summary:o.editorial?.short_summary||"",practical:o.editorial?.practical||"",
 expectation_vs_reality:o.editorial?.expectation_vs_reality||"",before_you_go:o.editorial?.before_you_go||[],
 curiosity_questions:o.editorial?.curiosity_questions||[]},updated_at:o.updated_at||payload.updated_at||null
}));
if(objects.some(o=>!o.topic_id||!o.editorial.short_summary||!o.editorial.practical||!o.editorial.before_you_go.length))throw new Error("Incomplete public knowledge article");
if(objects.some(o=>/https?:\/\//i.test(JSON.stringify(o.editorial))))throw new Error("External URL in editorial");
if(objects.some(o=>o.links.some(x=>!x.label||!/^https:\/\//i.test(x.url))))throw new Error("Invalid public article link");
if(/"research"\s*:|"sources"\s*:/i.test(JSON.stringify(objects)))throw new Error("Source fields leaked");
fs.writeFileSync(out,JSON.stringify({schema_version:"1.1",generated_at:new Date().toISOString(),count:objects.length,photographed:objects.filter(o=>o.media.images.length).length,objects},null,2)+"\n");
// Homepage consumes a small public-only feed, never the internal research store.
// This feeds deterministic daily rotation without downloading all 128 full articles.
const homepageObjects=objects.map(o=>({
  topic_id:o.topic_id,topic_type:o.topic_type,title:o.title,route:o.route,
  short_summary:o.editorial.short_summary,
  image:o.media?.images?.[0]?{url:o.media.images[0].url,alt:o.media.images[0].alt}:null
}));
if(homepageObjects.length!==objects.length
  ||new Set(homepageObjects.map(o=>o.topic_id)).size!==homepageObjects.length
  ||homepageObjects.some(o=>!o.route.startsWith("/guide/article.html?id="))){
  throw new Error("Invalid homepage knowledge feed");
}
fs.writeFileSync(path.join(root,"data/views/knowledge-home.json"),
  JSON.stringify({schema_version:"1.0",count:homepageObjects.length,objects:homepageObjects})+"\n");
console.log("Homepage knowledge feed:",homepageObjects.length,"approved teasers");

console.log("Public knowledge view:",objects.length,"articles,",objects.filter(o=>o.media.images.length).length,"with photos");
