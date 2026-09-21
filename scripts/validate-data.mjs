import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const entityDir=path.join(root,"data","entities");
const entityFiles=fs.readdirSync(entityDir).filter(name=>name.endsWith(".json")).sort();

const errors=[];
const warnings=[];
const ids=new Map();
const entities=[];

for(const file of entityFiles){
  const full=path.join(entityDir,file);
  let payload;
  try{
    payload=JSON.parse(fs.readFileSync(full,"utf8"));
  }catch(error){
    errors.push(file+": invalid JSON - "+error.message);
    continue;
  }

  for(const entity of payload.entities||[]){
    entities.push(entity);
    if(!entity.id) errors.push(file+": entity missing id");
    if(!entity.entity_type) errors.push((entity.id||file)+": missing entity_type");
    if(!entity.name) errors.push((entity.id||file)+": missing name");
    if(entity.id){
      if(ids.has(entity.id)) errors.push("duplicate entity id: "+entity.id+" in "+file+" and "+ids.get(entity.id));
      else ids.set(entity.id,file);
    }
  }
}

const knownIds=new Set(ids.keys());
const externalPrefixes=["live_"];

for(const entity of entities){
  if(entity.map){
    const {lat,lon,precision,source,verified_at}=entity.map;
    if(!Number.isFinite(lat)||lat < -90||lat > 90) errors.push(entity.id+": invalid map.lat");
    if(!Number.isFinite(lon)||lon < -180||lon > 180) errors.push(entity.id+": invalid map.lon");
    if(!new Set(["exact_entrance","site_centroid","area_anchor","route_anchor"]).has(precision)) errors.push(entity.id+": invalid map.precision");
    if(!source) errors.push(entity.id+": map source is required");
    if(!verified_at) errors.push(entity.id+": map verified_at is required");
  }
  if(entity.entity_type==="hotel"){
    const validStatuses=new Set(["active","active_new_not_in_sdl","upcoming"]);
    if(!validStatuses.has(entity.operational_status)) errors.push(entity.id+": invalid hotel operational_status");
    if(entity.star_rating!=null && (!Number.isInteger(entity.star_rating) || entity.star_rating<1 || entity.star_rating>5)){
      errors.push(entity.id+": hotel star_rating must be an integer from 1 to 5 or null");
    }
    if(!entity.zone_id) errors.push(entity.id+": hotel missing zone_id");
  }
  for(const rel of entity.related_entities||[]){
    const external=externalPrefixes.some(prefix=>String(rel).startsWith(prefix));
    if(!external && !knownIds.has(rel)) warnings.push(entity.id+": relationship target not found in entity layer: "+rel);
  }
}

const mapCoveragePath=path.join(root,"data","views","map-coverage.json");
try{
  const mapCoverage=JSON.parse(fs.readFileSync(mapCoveragePath,"utf8"));
  const ready=entities.filter(entity=>Number.isFinite(entity.map?.lat)&&Number.isFinite(entity.map?.lon));
  if(mapCoverage.summary?.ready_count!==ready.length) errors.push("map coverage ready_count is stale; rebuild map coverage");
  for(const layer of Object.values(mapCoverage.layers||{})){
    for(const item of layer||[]){
      if(!knownIds.has(item.id)) errors.push("map layer references missing entity: "+item.id);
    }
  }
}catch(error){
  errors.push("map-coverage.json invalid or missing: "+error.message);
}

const facetPath=path.join(root,"data","views","explore-facets.json");
try{
  const facets=JSON.parse(fs.readFileSync(facetPath,"utf8"));
  const facetIds=new Set();
  for(const facet of facets.intents||[]){
    if(!facet.id) errors.push("explore facet missing id");
    if(facetIds.has(facet.id)) errors.push("duplicate explore facet id: "+facet.id);
    facetIds.add(facet.id);
    for(const entityId of facet.include_ids||[]){
      if(!knownIds.has(entityId)) errors.push("explore facet "+facet.id+" references missing entity: "+entityId);
    }
  }
}catch(error){
  errors.push("explore-facets.json invalid or missing: "+error.message);
}

const searchPath=path.join(root,"data","views","search-index.json");
try{
  const search=JSON.parse(fs.readFileSync(searchPath,"utf8"));
  const seen=new Set();
  for(const doc of search.documents||[]){
    if(!doc.id) errors.push("search document missing id");
    if(seen.has(doc.id)) errors.push("duplicate search document id: "+doc.id);
    seen.add(doc.id);
    if(!doc.route || !String(doc.route).startsWith("/")) errors.push((doc.id||"search doc")+": invalid route");
  }

  let storyCount=0,curiosityCount=0;
  try{storyCount=(JSON.parse(fs.readFileSync(path.join(root,"data","content.json"),"utf8")).stories||[]).length}catch(error){}
  try{curiosityCount=(JSON.parse(fs.readFileSync(path.join(root,"data","home-support.json"),"utf8")).curiosity||[]).length}catch(error){}
  const expected=entities.length+5+storyCount+curiosityCount;
  const actual=(search.documents||[]).length;
  if(actual!==expected) errors.push("search index count mismatch: expected "+expected+", got "+actual);
}catch(error){
  errors.push("search-index.json invalid or missing: "+error.message);
}

const planningPath=path.join(root,"data","views","place-planning-levels.json");
try{
  const planning=JSON.parse(fs.readFileSync(planningPath,"utf8"));
  const placeActivityIds=new Set(entities.filter(x=>x.entity_type==="place"||x.entity_type==="activity").map(x=>x.id));
  const seen=new Set();
  for(const item of planning.items||[]){
    if(!placeActivityIds.has(item.entity_id)) errors.push("planning level references missing place/activity: "+item.entity_id);
    if(seen.has(item.entity_id)) errors.push("duplicate planning level entity: "+item.entity_id);
    seen.add(item.entity_id);
    if(![1,2,3].includes(item.level)) errors.push(item.entity_id+": planning level must be 1, 2 or 3");
  }
  for(const id of placeActivityIds){
    if(!seen.has(id)) errors.push("planning level missing entity: "+id);
  }
}catch(error){
  errors.push("place-planning-levels.json invalid or missing: "+error.message);
}

const liveBindingsPath=path.join(root,"data","views","live-bindings.json");
try{
  const payload=JSON.parse(fs.readFileSync(liveBindingsPath,"utf8"));
  const seen=new Set();
  const allowedLiveIds=new Set(["live_airport","live_transport","live_weather","live_marine"]);
  for(const binding of payload.bindings||[]){
    const key=binding.entity_id+":"+binding.category;
    if(seen.has(key)) errors.push("duplicate live binding: "+key);
    seen.add(key);
    if(!knownIds.has(binding.entity_id)) errors.push("live binding references missing entity: "+binding.entity_id);
    if(!allowedLiveIds.has(binding.live_id)) errors.push(binding.entity_id+": unsupported live_id "+binding.live_id);
    if(!binding.source_id) errors.push(binding.entity_id+": live binding missing source_id");
    if(!binding.route||!String(binding.route).startsWith("/")) errors.push(binding.entity_id+": live binding has invalid route");
  }
}catch(error){
  errors.push("live-bindings.json invalid or missing: "+error.message);
}

for(const warning of warnings) console.warn("WARN",warning);

if(errors.length){
  for(const error of errors) console.error("ERROR",error);
  process.exit(1);
}

console.log("Data validation OK:",entities.length,"entities,",ids.size,"unique IDs,",warnings.length,"relationship warnings");
