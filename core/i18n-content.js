/* Locale-aware content overlay loader. Non-Vietnamese content is fail-closed:
 * only records that have a reviewed translation overlay are returned. */
(function(root){
"use strict";
const copy=v=>JSON.parse(JSON.stringify(v));
const text=v=>typeof v==="string"?v:undefined;
const locale=()=>root.OpenPQI18n?.locale?.()||"vi";
async function json(url){
  const res=await fetch(url,{cache:"default"});
  if(!res.ok)throw Error(url+" "+res.status);
  return res.json();
}
function put(target,source,key){const v=text(source?.[key]);if(v!==undefined)target[key]=v}
function strings(target,source,key){if(Array.isArray(source?.[key])&&source[key].every(x=>typeof x==="string"))target[key]=[...source[key]]}
function story(base,tr){
  if(!base||!tr||base.id!==tr.id)return null;
  const out=copy(base);
  ["title","category","dek","intro","image_alt","image_caption"].forEach(k=>put(out,tr,k));
  if(Array.isArray(tr.sections))out.sections=(base.sections||[]).map((s,i)=>{const row={...s},x=tr.sections[i];if(x) ["heading","body","caption"].forEach(k=>put(row,x,k));return row});
  return out;
}
function knowledge(base,tr){
  if(!base||!tr||base.topic_id!==tr.topic_id)return null;
  const out=copy(base);put(out,tr,"title");
  if(tr.editorial){out.editorial={...(out.editorial||{})};["short_summary","practical","expectation_vs_reality"].forEach(k=>put(out.editorial,tr.editorial,k));strings(out.editorial,tr.editorial,"before_you_go")}
  if(Array.isArray(tr.media?.images)&&Array.isArray(out.media?.images))out.media={...out.media,images:out.media.images.map((img,i)=>{const row={...img},x=tr.media.images[i];if(x)["alt","caption"].forEach(k=>put(row,x,k));return row})};
  if(Array.isArray(tr.links)&&Array.isArray(out.links))out.links=out.links.map((link,i)=>{const row={...link},x=tr.links[i];if(x)put(row,x,"label");return row});
  return out;
}
async function stories(){
  const base=await json("/data/content.json"),lang=locale();
  if(lang==="vi")return base;
  const overlay=await json("/data/i18n/"+encodeURIComponent(lang)+"/stories.json");
  const byId=new Map((overlay.stories||[]).filter(x=>x?.id).map(x=>[x.id,x]));
  return {...base,stories:(base.stories||[]).filter(x=>byId.has(x.id)).map(x=>story(x,byId.get(x.id))).filter(Boolean)};
}
async function knowledgeData(){
  const base=await json("/data/views/knowledge-public.json"),lang=locale();
  if(lang==="vi")return base;
  const overlay=await json("/data/i18n/"+encodeURIComponent(lang)+"/knowledge.json");
  const byId=new Map((overlay.objects||[]).filter(x=>x?.topic_id).map(x=>[x.topic_id,x]));
  return {...base,objects:(base.objects||[]).filter(x=>byId.has(x.topic_id)).map(x=>knowledge(x,byId.get(x.topic_id))).filter(Boolean)};
}
root.OpenPQI18nContent={locale,stories,knowledge:knowledgeData,mergeStory:story,mergeKnowledge:knowledge};
})(window);
