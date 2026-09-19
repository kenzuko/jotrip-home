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

  const expected=entities.length+3;
  const actual=(search.documents||[]).length;
  if(actual!==expected) errors.push("search index count mismatch: expected "+expected+", got "+actual);
}catch(error){
  errors.push("search-index.json invalid or missing: "+error.message);
}

for(const warning of warnings) console.warn("WARN",warning);

if(errors.length){
  for(const error of errors) console.error("ERROR",error);
  process.exit(1);
}

console.log("Data validation OK:",entities.length,"entities,",ids.size,"unique IDs,",warnings.length,"relationship warnings");
