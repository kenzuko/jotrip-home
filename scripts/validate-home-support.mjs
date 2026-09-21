import fs from "node:fs";
import path from "node:path";
const root=process.cwd(),errors=[];
const support=JSON.parse(fs.readFileSync(path.join(root,"data","home-support.json"),"utf8"));
const ids=new Set(),entityMap=new Map();
for(const file of fs.readdirSync(path.join(root,"data","entities")).filter(x=>x.endsWith(".json"))){const p=JSON.parse(fs.readFileSync(path.join(root,"data","entities",file),"utf8"));for(const e of p.entities||[])if(e.id){ids.add(e.id);entityMap.set(e.id,e)}}
const content=JSON.parse(fs.readFileSync(path.join(root,"data","content.json"),"utf8")),storyIds=new Set((content.stories||[]).map(x=>x.id));\nconst sourceRegistry=JSON.parse(fs.readFileSync(path.join(root,"data","source-registry.json"),"utf8")),sourceIds=new Set((sourceRegistry.sources||[]).map(x=>x.id));
const refs=[...(support.trip_clock?.items||[]).map(x=>["trip_clock",x.entity_id]),...(support.activity_board||[]).map(x=>["activity_board",x.entity_id])];
for(const [surface,id] of refs)if(!ids.has(id))errors.push(surface+" references missing entity: "+id);
for(const item of support.trip_clock?.items||[]){if(item.schedule_source==="canonical_entity.opening_hours"){const opening=entityMap.get(item.entity_id)?.opening_hours;if(!opening)errors.push("trip_clock schedule missing canonical opening_hours: "+item.entity_id);else if(opening.state==="PUBLISHED_SCHEDULE"){if(!(opening.windows||[]).length)errors.push(item.entity_id+": published schedule missing windows");if(!opening.source_id)errors.push(item.entity_id+": published schedule missing source_id");if(!opening.verified_at)errors.push(item.entity_id+": published schedule missing verified_at")}else if(opening.state==="NEEDS_VERIFICATION"&&(opening.claims||[]).length<2)errors.push(item.entity_id+": schedule conflict needs multiple claims")}}
for(const area of support.near_me?.manual_areas||[])if(area.type==="place"&&!ids.has(area.id))errors.push("near_me area references missing place: "+area.id);
for(const item of support.curiosity||[])if(!storyIds.has(item.story_id))errors.push("curiosity references missing story: "+item.story_id);
const cats=(support.near_me?.categories||[]).map(x=>x.id);if(new Set(cats).size!==cats.length)errors.push("duplicate near_me category id");
if(support.near_me?.request_location_on_load!==false)errors.push("near_me must not request location on load");
if(errors.length){for(const e of errors)console.error("ERROR",e);process.exit(1)}
console.log("Homepage support validation OK:",refs.length,"entity refs,",cats.length,"near-me categories,",support.curiosity?.length||0,"curiosity seeds");
