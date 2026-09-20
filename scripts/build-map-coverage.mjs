import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const entityDir=path.join(root,"data","entities");
const files=fs.readdirSync(entityDir).filter(name=>name.endsWith(".json")).sort();
const entities=files.flatMap(file=>JSON.parse(fs.readFileSync(path.join(entityDir,file),"utf8")).entities||[]);
const mappableTypes=new Set(["zone","place","activity","hotel","utility","access"]);
const candidates=entities.filter(entity=>mappableTypes.has(entity.entity_type));
const ready=candidates.filter(entity=>Number.isFinite(entity.map?.lat)&&Number.isFinite(entity.map?.lon));
const missing=candidates.filter(entity=>!Number.isFinite(entity.map?.lat)||!Number.isFinite(entity.map?.lon));

const output={
  schema_version:"1.0",
  generated_at:new Date().toISOString(),
  contract:{
    coordinate_system:"WGS84",
    required_fields:["lat","lon","precision","source","verified_at"],
    precision_values:["exact_entrance","site_centroid","area_anchor","route_anchor"],
    rule:"Không hiển thị pin công khai nếu thiếu nguồn hoặc mức độ chính xác. area_anchor chỉ dùng định hướng vùng."
  },
  summary:{candidate_count:candidates.length,ready_count:ready.length,missing_count:missing.length},
  layers:{
    zones:ready.filter(x=>x.entity_type==="zone").map(x=>({id:x.id,name:x.name,...x.map})),
    places:ready.filter(x=>x.entity_type==="place"||x.entity_type==="activity").map(x=>({id:x.id,name:x.name,type:x.entity_type,...x.map})),
    stay:ready.filter(x=>x.entity_type==="hotel").map(x=>({id:x.id,name:x.name,...x.map})),
    utilities:ready.filter(x=>x.entity_type==="utility"||x.entity_type==="access").map(x=>({id:x.id,name:x.name,type:x.entity_type,...x.map}))
  },
  missing_ids:missing.map(x=>x.id)
};

fs.writeFileSync(path.join(root,"data","views","map-coverage.json"),JSON.stringify(output,null,2)+"\n");
console.log(`Map coverage: ${ready.length}/${candidates.length} entities ready`);
