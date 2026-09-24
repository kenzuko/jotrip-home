import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const entityDir=path.join(root,"data","entities");
const files=fs.readdirSync(entityDir).filter(name=>name.endsWith(".json")).sort();
const entities=files.flatMap(file=>JSON.parse(fs.readFileSync(path.join(entityDir,file),"utf8")).entities||[]);
const byId=new Map(entities.map(x=>[x.id,x]));

function validMap(map){
  return Number.isFinite(map?.lat)&&Number.isFinite(map?.lon);
}
function placeTags(entity){
  const tags=new Set(["DESTINATION"]);
  const cats=new Set(entity.categories||[]);
  if(cats.has("beach"))tags.add("BEACH");
  if(["theme-park","waterpark","wildlife","museum","entertainment","show","thrill"].some(x=>cats.has(x)))tags.add("ENTERTAINMENT");
  if(["culture","history","lore","craft","agriculture"].some(x=>cats.has(x)))tags.add("CULTURE");
  if(["market","food"].some(x=>cats.has(x))||/chợ/i.test(entity.name||""))tags.add("MARKET");
  return [...tags];
}
function fixedActivity(entity){
  const cats=new Set(entity.categories||[]);
  return cats.has("show")||cats.has("cable-car");
}
function inheritedPlace(entity){
  for(const id of entity.related_entities||[]){
    const related=byId.get(id);
    if(related?.entity_type==="place"&&(related.address||validMap(related.map)))return related;
  }
  return null;
}
function routeFor(entity){
  if(entity.entity_type==="place")return "/places/detail.html?id="+encodeURIComponent(entity.slug||entity.legacy_id||entity.id.replace(/^place_/,""));
  if(entity.entity_type==="activity")return "/places/detail.html?id="+encodeURIComponent(entity.slug||entity.legacy_id||entity.id.replace(/^activity_/,""));
  if(entity.entity_type==="hotel")return "/hotels/?q="+encodeURIComponent(entity.name||"");
  if(entity.entity_type==="utility")return "/utilities/";
  return null;
}

const documents=[];
for(const entity of entities){
  if(!["place","activity","hotel","utility"].includes(entity.entity_type))continue;

  let address=entity.address||null;
  let map=validMap(entity.map)?entity.map:null;
  let inherited_from=null;

  if(entity.entity_type==="activity"){
    if(!fixedActivity(entity)&&!address&&!map)continue;
    if((!address||!map)){
      const parent=inheritedPlace(entity);
      if(parent){
        if(!address)address=parent.address||null;
        if(!map&&validMap(parent.map))map={...parent.map,precision:"area_anchor",note:"Kế thừa vị trí khu tổ chức "+parent.name+"; không phải pin sân khấu/cửa vào chính xác."};
        inherited_from=parent.id;
      }
    }
  }

  if(entity.entity_type==="utility"&&!address&&!map)continue;
  if(entity.entity_type==="place"&&!address&&!map)continue;
  if(entity.entity_type==="hotel"&&!address&&!map)continue;

  const tags=[];
  if(entity.entity_type==="place")tags.push(...placeTags(entity));
  if(entity.entity_type==="hotel")tags.push("HOTEL");
  if(entity.entity_type==="utility"&&entity.utility_type)tags.push(entity.utility_type);
  if(entity.entity_type==="activity"){
    tags.push("ACTIVITY");
    const cats=new Set(entity.categories||[]);
    if(cats.has("show"))tags.push("ENTERTAINMENT");
  }

  documents.push({
    id:entity.id,
    entity_type:entity.entity_type,
    name:entity.name||entity.id,
    aliases:entity.aliases||[],
    zone_id:entity.zone_id||null,
    categories:entity.categories||[],
    tags:[...new Set(tags)],
    address,
    address_precision:entity.address_precision||null,
    phone:entity.phone||null,
    group:entity.group||null,
    utility_type:entity.utility_type||null,
    opening_hours:entity.opening_hours||null,
    opening_hours_note:entity.opening_hours_note||null,
    phone_alt:entity.phone_alt||null,
    verified:entity.verified??null,
    updated_at:entity.updated_at||null,
    star_rating:entity.star_rating??null,
    what_it_is:entity.what_it_is||"",
    route:routeFor(entity),
    map:map?{
      lat:map.lat,
      lon:map.lon,
      precision:map.precision||null,
      source:map.source||null,
      source_id:map.source_id||null,
      verified_at:map.verified_at||null,
      note:map.note||null,
      accuracy:map.accuracy||null,
      plus_code:map.plus_code||null
    }:null,
    inherited_from,
    google_query:[entity.name,address,"Phú Quốc"].filter(Boolean).join(", ")
  });
}

documents.sort((a,b)=>a.entity_type.localeCompare(b.entity_type)||a.name.localeCompare(b.name,"vi"));

const countByType=documents.reduce((acc,x)=>{acc[x.entity_type]=(acc[x.entity_type]||0)+1;return acc},{});
const output={
  schema_version:"1.0",
  generated_at:new Date().toISOString(),
  purpose:"Near Me / location lookup index. Không chứa nội dung dài; chỉ các trường cần để tìm địa chỉ, pin và đường đi.",
  summary:{
    total:documents.length,
    with_address:documents.filter(x=>x.address).length,
    with_map:documents.filter(x=>validMap(x.map)).length,
    by_type:countByType
  },
  documents
};
fs.writeFileSync(path.join(root,"data","views","location-index.json"),JSON.stringify(output,null,2)+"\n");
console.log("Location index:",output.summary);
