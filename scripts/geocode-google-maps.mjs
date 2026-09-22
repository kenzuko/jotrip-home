import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const entityDir=path.join(root,"data","entities");
const apiKey=process.env.GOOGLE_MAPS_API_KEY||"";
const args=new Set(process.argv.slice(2));
const dryRun=args.has("--dry-run");
const force=args.has("--force");
const limitArg=process.argv.find(x=>x.startsWith("--limit="));
const limit=limitArg?Math.max(1,Number(limitArg.split("=")[1])||1):Infinity;

if(!apiKey){
  console.error("GOOGLE_MAPS_API_KEY is required.");
  process.exit(1);
}

const PHU_QUOC_BOUNDS={south:9.80,north:10.55,west:103.75,east:104.25};
const TODAY=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function inPhuQuoc(lat,lon){
  return Number.isFinite(lat)&&Number.isFinite(lon)&&
    lat>=PHU_QUOC_BOUNDS.south&&lat<=PHU_QUOC_BOUNDS.north&&
    lon>=PHU_QUOC_BOUNDS.west&&lon<=PHU_QUOC_BOUNDS.east;
}

function queryFor(entity){
  const parts=[entity.name,entity.address,"Phú Quốc","An Giang","Việt Nam"].filter(Boolean);
  return [...new Set(parts.map(x=>String(x).trim()).filter(Boolean))].join(", ");
}

function precisionForTypes(types=[]){
  const broad=new Set(["locality","administrative_area_level_1","administrative_area_level_2","administrative_area_level_3","route","neighborhood","sublocality"]);
  return types.some(x=>broad.has(x))?"area_anchor":"site_centroid";
}

async function googlePlaceSearch(query){
  const response=await fetch("https://places.googleapis.com/v1/places:searchText",{
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "X-Goog-Api-Key":apiKey,
      "X-Goog-FieldMask":"places.id,places.displayName,places.formattedAddress,places.location,places.types"
    },
    body:JSON.stringify({
      textQuery:query,
      languageCode:"vi",
      regionCode:"VN",
      maxResultCount:5,
      locationBias:{
        circle:{
          center:{latitude:10.2270,longitude:103.9670},
          radius:60000
        }
      }
    })
  });
  if(!response.ok)throw new Error("Places search HTTP "+response.status);
  const payload=await response.json();
  const candidates=(payload.places||[]).map(p=>({
    resolver:"GOOGLE_PLACES_TEXT_SEARCH",
    place_id:p.id||null,
    name:p.displayName?.text||null,
    formatted_address:p.formattedAddress||null,
    lat:Number(p.location?.latitude),
    lon:Number(p.location?.longitude),
    types:p.types||[]
  })).filter(x=>inPhuQuoc(x.lat,x.lon));
  return candidates[0]||null;
}

async function googleGeocode(address){
  const url=new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address",address);
  url.searchParams.set("key",apiKey);
  url.searchParams.set("language","vi");
  url.searchParams.set("region","vn");
  url.searchParams.set("bounds","9.80,103.75|10.55,104.25");
  const response=await fetch(url);
  if(!response.ok)throw new Error("Geocoding HTTP "+response.status);
  const payload=await response.json();
  if(payload.status!=="OK"&&payload.status!=="ZERO_RESULTS")throw new Error("Geocoding status "+payload.status);
  const result=(payload.results||[]).find(r=>inPhuQuoc(Number(r.geometry?.location?.lat),Number(r.geometry?.location?.lng)));
  if(!result)return null;
  return {
    resolver:"GOOGLE_GEOCODING",
    place_id:result.place_id||null,
    name:null,
    formatted_address:result.formatted_address||null,
    lat:Number(result.geometry?.location?.lat),
    lon:Number(result.geometry?.location?.lng),
    types:result.types||[],
    location_type:result.geometry?.location_type||null
  };
}

async function resolveEntity(entity){
  const query=queryFor(entity);
  let match=null;
  try{match=await googlePlaceSearch(query)}catch(error){
    console.warn("WARN Places",entity.id,error.message);
  }
  if(!match&&entity.address){
    try{match=await googleGeocode([entity.name,entity.address,"Phú Quốc, An Giang, Việt Nam"].filter(Boolean).join(", "))}catch(error){
      console.warn("WARN Geocode",entity.id,error.message);
    }
  }
  if(!match)return {query,match:null};
  return {query,match};
}

const files=fs.readdirSync(entityDir).filter(x=>x.endsWith(".json")).sort();
let attempted=0,resolved=0,changedFiles=0,skipped=0;

for(const file of files){
  if(attempted>=limit)break;
  const filePath=path.join(entityDir,file);
  const data=JSON.parse(fs.readFileSync(filePath,"utf8"));
  let changed=false;

  for(const entity of data.entities||[]){
    if(attempted>=limit)break;
    if(!["utility","place","hotel","activity","access"].includes(entity.entity_type))continue;
    if(!entity.address&&!entity.name)continue;

    const hasMap=Number.isFinite(entity.map?.lat)&&Number.isFinite(entity.map?.lon);
    if(hasMap&&!force){skipped++;continue;}

    attempted++;
    const {query,match}=await resolveEntity(entity);
    if(!match){
      console.warn("MISS",entity.id,query);
      await sleep(120);
      continue;
    }

    const precision=precisionForTypes(match.types);
    entity.map={
      lat:match.lat,
      lon:match.lon,
      precision,
      source_id:"google_maps_location_lookup",
      source:"Google Maps location lookup",
      verified_at:TODAY,
      accuracy:match.resolver,
      google_place_id:match.place_id,
      matched_name:match.name,
      formatted_address:match.formatted_address,
      lookup_query:query,
      location_type:match.location_type||null,
      note:precision==="area_anchor"
        ?"Tọa độ suy từ kết quả Google ở mức khu vực/đường, dùng để định hướng chứ không giả là cửa vào chính xác."
        :"Tọa độ suy từ kết quả địa điểm Google theo tên và địa chỉ; có thể tiếp tục nâng cấp nếu sau này có pin chính thức."
    };
    entity.updated_at=TODAY;
    changed=true;
    resolved++;
    console.log("OK",entity.id,match.lat,match.lon,precision,match.formatted_address||"");
    await sleep(120);
  }

  if(changed){
    changedFiles++;
    if(!dryRun)fs.writeFileSync(filePath,JSON.stringify(data,null,2)+"\n");
  }
}

console.log(JSON.stringify({
  attempted,
  resolved,
  skipped_existing:skipped,
  changed_files:changedFiles,
  dry_run:dryRun
},null,2));
