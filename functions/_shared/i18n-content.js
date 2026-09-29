const text=v=>typeof v==="string"?v:undefined;
const copy=o=>JSON.parse(JSON.stringify(o));
function applyText(target,source,key){const v=text(source?.[key]);if(v!==undefined)target[key]=v}
function applyTextArray(target,source,key){
  if(Array.isArray(source?.[key])&&source[key].every(x=>typeof x==="string"))target[key]=[...source[key]];
}
export function mergeStory(base,translation){
  if(!base||!translation||base.id!==translation.id)return null;
  const out=copy(base);
  for(const key of ["title","category","dek","intro","image_alt","image_caption"])applyText(out,translation,key);
  if(Array.isArray(translation.sections)){
    out.sections=(base.sections||[]).map((section,i)=>{
      const row={...section},tr=translation.sections[i];
      if(tr&&typeof tr==="object")for(const key of ["heading","body","caption"])applyText(row,tr,key);
      return row;
    });
  }
  return out;
}
export function mergeKnowledge(base,translation){
  if(!base||!translation||base.topic_id!==translation.topic_id)return null;
  const out=copy(base);applyText(out,translation,"title");
  if(translation.editorial&&typeof translation.editorial==="object"){
    out.editorial={...(out.editorial||{})};
    for(const key of ["short_summary","practical","expectation_vs_reality"])applyText(out.editorial,translation.editorial,key);
    applyTextArray(out.editorial,translation.editorial,"before_you_go");
    applyTextArray(out.editorial,translation.editorial,"curiosity_questions");
  }
  if(Array.isArray(translation.media?.images)&&Array.isArray(out.media?.images)){
    out.media={...out.media,images:out.media.images.map((img,i)=>{
      const row={...img},tr=translation.media.images[i];
      if(tr&&typeof tr==="object")for(const key of ["alt","caption"])applyText(row,tr,key);
      return row;
    })};
  }
  if(Array.isArray(translation.links)&&Array.isArray(out.links)){
    out.links=out.links.map((link,i)=>{
      const row={...link},tr=translation.links[i];
      if(tr&&typeof tr==="object")applyText(row,tr,"label");
      return row;
    });
  }
  return out;
}
export function translatedStories(baseData,overlay){
  const byId=new Map((overlay?.stories||[]).filter(x=>x?.id).map(x=>[x.id,x]));
  return {...baseData,stories:(baseData?.stories||[]).filter(x=>byId.has(x.id)).map(x=>mergeStory(x,byId.get(x.id))).filter(Boolean)};
}
export function translatedKnowledge(baseData,overlay){
  const byId=new Map((overlay?.objects||[]).filter(x=>x?.topic_id).map(x=>[x.topic_id,x]));
  return {...baseData,objects:(baseData?.objects||[]).filter(x=>byId.has(x.topic_id)).map(x=>mergeKnowledge(x,byId.get(x.topic_id))).filter(Boolean)};
}
