import fs from "node:fs";
import path from "node:path";

// Only editor-linked stories get a map. Never fabricate one from a generic
// photo credit, food topic, or unrelated zone.
const root=process.cwd();
const visual=JSON.parse(fs.readFileSync(path.join(root,"data/visual-context.json"),"utf8"));
const dir=path.join(root,"data/entities");
const entities=fs.readdirSync(dir).filter(x=>x.endsWith(".json"))
  .flatMap(file=>JSON.parse(fs.readFileSync(path.join(dir,file),"utf8")).entities||[]);
const byId=new Map(entities.map(entity=>[entity.id,entity]));
const validMap=map=>map&&
  Number.isFinite(map.lat)&&Number.isFinite(map.lon)&&
  map.lat>=9.4&&map.lat<=10.6&&map.lon>=103.4&&map.lon<=104.6&&
  ["exact_entrance","site_centroid","area_anchor","route_anchor"].includes(map.precision)&&
  typeof map.source==="string"&&!!map.source.trim()&&
  typeof map.verified_at==="string"&&!!map.verified_at.trim();
const stories={};
for(const [id,meta] of Object.entries(visual.stories||{})){
  if(!meta.entity_id&&!meta.map_zone)continue;
  const entity=byId.get(meta.entity_id||(meta.map_zone?meta.zone_id:null));
  if(!entity||!validMap(entity.map))
    throw new Error("Missing reviewed story location for "+id);
  stories[id]={
    entity_id:entity.id,
    label:meta.entity_id?entity.name:(meta.location_label||entity.name),
    map:{
      lat:entity.map.lat,lon:entity.map.lon,precision:entity.map.precision,
      anchor_name:entity.map.anchor_name||entity.name,
      source:entity.map.source,verified_at:entity.map.verified_at,
      note:entity.map.note||null
    }
  };
}
const output={schema_version:"1.0",generated_at:new Date().toISOString(),
  count:Object.keys(stories).length,stories};
fs.writeFileSync(path.join(root,"data/views/story-locations.json"),
  JSON.stringify(output,null,2)+"\n");
console.log("Reviewed story maps:",output.count);
