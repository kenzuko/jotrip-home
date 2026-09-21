import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const errors=[];
const readJson=(p)=>JSON.parse(fs.readFileSync(path.join(root,p),"utf8"));

const support=readJson("data/home-support.json");
const content=readJson("data/content.json");
const sourceRegistry=readJson("data/source-registry.json");

const ids=new Set();
const entityMap=new Map();

for(const file of fs.readdirSync(path.join(root,"data","entities")).filter(x=>x.endsWith(".json"))){
  const data=readJson(path.join("data","entities",file));
  for(const entity of data.entities||[]){
    if(!entity.id) continue;
    ids.add(entity.id);
    entityMap.set(entity.id,entity);
  }
}

const storyIds=new Set((content.stories||[]).map(x=>x.id));
const sourceIds=new Set((sourceRegistry.sources||[]).map(x=>x.id));
const categoryIds=(support.near_me?.categories||[]).map(x=>x.id);
const categorySet=new Set(categoryIds);

const refs=[
  ...(support.trip_clock?.items||[]).map(x=>["trip_clock",x.entity_id]),
  ...(support.activity_board||[]).map(x=>["activity_board",x.entity_id])
];

for(const [surface,id] of refs){
  if(!ids.has(id)) errors.push(surface+" references missing entity: "+id);
}

for(const item of support.trip_clock?.items||[]){
  if(item.schedule_source!=="canonical_entity.opening_hours") continue;
  const opening=entityMap.get(item.entity_id)?.opening_hours;
  if(!opening){
    errors.push("trip_clock schedule missing canonical opening_hours: "+item.entity_id);
    continue;
  }
  if(opening.state==="PUBLISHED_SCHEDULE"){
    if(!(opening.windows||[]).length) errors.push(item.entity_id+": published schedule missing windows");
    if(!opening.source_id) errors.push(item.entity_id+": published schedule missing source_id");
    if(!opening.verified_at) errors.push(item.entity_id+": published schedule missing verified_at");
  }
  if(opening.state==="NEEDS_VERIFICATION"&&(opening.claims||[]).length<2){
    errors.push(item.entity_id+": schedule conflict needs multiple claims");
  }
}

for(const area of support.near_me?.manual_areas||[]){
  if(area.type==="place"&&!ids.has(area.id)) errors.push("near_me area references missing place: "+area.id);
}

if(categorySet.size!==categoryIds.length) errors.push("duplicate near_me category id");

for(const item of support.near_me?.items||[]){
  if(!item.utility_id){
    errors.push("near_me item missing utility_id");
    continue;
  }
  const utility=entityMap.get(item.utility_id);
  if(!utility||utility.entity_type!=="utility"){
    errors.push("near_me item references missing canonical utility: "+item.utility_id);
    continue;
  }
  if(!categorySet.has(utility.utility_type)) errors.push("near_me canonical utility has unknown utility type: "+item.utility_id);
  if(!utility.address&&!Number.isFinite(utility.map?.lat)) errors.push("near_me canonical utility missing address/coordinates: "+item.utility_id);
  if(!item.source_id||!sourceIds.has(item.source_id)) errors.push("near_me item source missing from registry: "+item.utility_id);
  if(!item.verified_at) errors.push("near_me item missing verified_at: "+item.utility_id);
  for(const field of ["name","address","phone","zone_id","utility_type","lat","lon"]){
    if(Object.hasOwn(item,field)) errors.push("near_me item duplicates canonical utility field "+field+": "+item.utility_id);
  }
}

for(const item of support.hot_now?.items||[]){
  if(!item.event_id) errors.push("hot_now item missing event_id");
  if(!item.source_id||!sourceIds.has(item.source_id)) errors.push("hot_now item source missing from registry: "+item.event_id);
  if(!item.verified_at) errors.push("hot_now item missing verified_at: "+item.event_id);
  if(!item.expires_at) errors.push("hot_now temporary item missing expires_at: "+item.event_id);
}

for(const item of support.curiosity||[]){
  if(!item.prompt_id||!item.question) errors.push("curiosity item missing prompt_id/question");
  if(item.story_id&&!storyIds.has(item.story_id)) errors.push("curiosity references missing story: "+item.story_id);
  if(item.place_id&&!ids.has(item.place_id)) errors.push("curiosity references missing place: "+item.place_id);
  if(!item.story_id&&!item.place_id&&!item.topic_id) errors.push("curiosity missing story/place/topic reference: "+item.prompt_id);
  if(!(item.source_ids||[]).length) errors.push("curiosity missing source_ids: "+item.prompt_id);
  for(const sourceId of item.source_ids||[]){
    if(!sourceIds.has(sourceId)) errors.push("curiosity source missing from registry: "+item.prompt_id+" -> "+sourceId);
  }
}

if(support.near_me?.request_location_on_load!==false){
  errors.push("near_me must not request location on load");
}

if(errors.length){
  for(const error of errors) console.error("ERROR",error);
  process.exit(1);
}

console.log(
  "Homepage support validation OK:",
  refs.length,"entity refs,",
  categoryIds.length,"near-me categories,",
  support.near_me?.items?.length||0,"near-me items,",
  support.hot_now?.items?.length||0,"hot-now items,",
  support.curiosity?.length||0,"curiosity seeds"
);
