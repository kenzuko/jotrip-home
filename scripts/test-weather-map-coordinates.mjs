import fs from "node:fs";

const config=JSON.parse(fs.readFileSync("scripts/weather-engine/weather/config/points.json","utf8"));
const spatial=fs.readFileSync("weather/spatial-lab.js","utf8");
const locationIndex=JSON.parse(fs.readFileSync("data/views/location-index.json","utf8"));

const mapPoints=new Map(
  [...spatial.matchAll(/^\\s{2}([a-z][a-z0-9_]*):\\{lat:([-0-9.]+),lon:([-0-9.]+)/gm)]
    .map(([,id,lat,lon])=>[id,{lat:Number(lat),lon:Number(lon)}])
);
const rad=x=>x*Math.PI/180;
function distanceKm(a,b){
  const dLat=rad(b.lat-a.lat),dLon=rad(b.lon-a.lon);
  const q=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;
  return 6371.0088*2*Math.asin(Math.sqrt(q));
}

const failures=[];
for(const [id,point] of Object.entries(config.points||{})){
  if(point.reference_type==="coastal_operations_reference")continue;
  const mapPoint=mapPoints.get(id);
  if(!mapPoint){failures.push(`Weather map is missing configured point: ${id}`);continue;}
  const distance=distanceKm({lat:point.lat,lon:point.lon},mapPoint);
  if(distance>0.08)failures.push(`Weather map point ${id} is ${distance.toFixed(2)} km from production coordinate`);
}

const island={south:9.8,north:10.55,west:103.75,east:104.25};
for(const item of locationIndex.documents||[]){
  if(!item.map)continue;
  const {lat,lon,precision,source,verified_at}=item.map;
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<island.south||lat>island.north||lon<island.west||lon>island.east){
    failures.push(`Map point outside Phu Quoc bounds: ${item.id}`);
  }
  if(!precision||!source||!verified_at)failures.push(`Map point lacks precision/source/date: ${item.id}`);
}

if(failures.length){
  console.error("Map coordinate validation failed:");
  for(const failure of failures)console.error(" - "+failure);
  process.exit(1);
}
console.log("Map coordinate validation passed:",mapPoints.size,"weather points and",locationIndex.summary.with_map,"mapped entries");
