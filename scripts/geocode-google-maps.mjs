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

function cleanLegacyAddress(address=""){
  return String(address)
    .replace(/Đặc khu Phú Quốc/gi,"Phú Quốc")
    .replace(/thành phố Phú Quốc/gi,"Phú Quốc")
    .replace(/tỉnh An Giang/gi,"")
    .replace(/An Giang/gi,"")
    .replace(/tỉnh Kiên Giang/gi,"")
    .replace(/Kiên Giang/gi,"")
    .replace(/\s+,/g,",")
    .replace(/,+/g,",")
    .replace(/\s{2,}/g," ")
    .trim()
    .replace(/^,|,$/g,"")
    .trim();
}

function normalizeText(value=""){
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
}

function nameTokens(name=""){
  const stop=new Set(["phu","quoc","hotel","resort","spa","homestay","bungalow","villa","villas","the","by","and","beach"]);
  return normalizeText(name).split(/\s+/).filter(x=>x.length>2&&!stop.has(x));
}

function nameLooksRight(entity,result){
  const wanted=nameTokens(entity.name);
  if(!wanted.length)return true;
  const hay=normalizeText([result.name,result.formatted_address].filter(Boolean).join(" "));
  const hits=wanted.filter(t=>hay.includes(t)).length;
  return hits>=Math.min(2,wanted.length);
}

function zoneMatches(entity,lat,lon){
  const zone=entity.zone_id;
  if(!zone)return true;
  if(zone==="zone_south")return lat<=10.13&&lon>=103.94;
  if(zone==="zone_north")return lat>=10.24;
  if(zone==="zone_central_west")return lat>=10.10&&lat<=10.31&&lon<=104.035;
  return true;
}

function categoryLooksRight(entity,result){
  const cls=String(result.class||"").toLowerCase();
  const type=String(result.type||"").toLowerCase();
  if(entity.entity_type==="hotel"){
    return cls==="tourism"&&["hotel","guest_house","resort","hostel","motel","apartment"].includes(type);
  }
  if(entity.entity_type!=="utility")return true;
  const allowed={
    PHARMACY:[["amenity","pharmacy"],["shop","chemist"]],
    ATM:[["amenity","atm"],["amenity","bank"]],
    FUEL:[["amenity","fuel"]],
    PARKING:[["amenity","parking"]],
    TOILET:[["amenity","toilets"]],
    MINIMART:[["shop","convenience"],["shop","supermarket"]],
    CLINIC_HOSPITAL:[["amenity","clinic"],["amenity","hospital"],["healthcare","clinic"],["healthcare","hospital"]]
  }[entity.utility_type];
  if(!allowed)return true;
  return allowed.some(([a,b])=>cls===a&&type===b);
}

function pickCandidate(entity,candidates,queryKind){
  const zoneSafe=candidates.filter(x=>inPhuQuoc(x.lat,x.lon)&&zoneMatches(entity,x.lat,x.lon));
  if(queryKind==="name"){
    return zoneSafe.find(x=>nameLooksRight(entity,x)&&categoryLooksRight(entity,x))||null;
  }
  return zoneSafe[0]||null;
}

function precisionForGoogleTypes(types=[]){
  const broad=new Set(["locality","administrative_area_level_1","administrative_area_level_2","administrative_area_level_3","route","neighborhood","sublocality"]);
  return types.some(x=>broad.has(x))?"area_anchor":"site_centroid";
}

function precisionForNominatim(result,entity){
  const broadTypes=new Set(["administrative","village","town","city","suburb","neighbourhood","quarter","residential","road","hamlet","island","beach"]);
  const broadClasses=new Set(["boundary","place"]);
  if(result.query_kind==="address"&&!categoryLooksRight(entity,result)){
    return result.class==="highway"||result.type==="road"?"route_anchor":"area_anchor";
  }
  if(broadTypes.has(result.type)||broadClasses.has(result.class))return"area_anchor";
  if(result.class==="highway")return"route_anchor";
  return"site_centroid";
}

async function googlePlaceSearch(query){
  if(!apiKey)return null;
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
    source_id:"google_maps_location_lookup",
    source:"Google Maps location lookup",
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
  if(!apiKey)return null;
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
    source_id:"google_maps_location_lookup",
    source:"Google Maps address geocoding",
    place_id:result.place_id||null,
    name:null,
    formatted_address:result.formatted_address||null,
    lat:Number(result.geometry?.location?.lat),
    lon:Number(result.geometry?.location?.lng),
    types:result.types||[],
    location_type:result.geometry?.location_type||null
  };
}

async function nominatimQuery(entity,q,queryKind){
  const url=new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q",q);
  url.searchParams.set("format","jsonv2");
  url.searchParams.set("limit","5");
  url.searchParams.set("addressdetails","1");
  url.searchParams.set("namedetails","1");
  url.searchParams.set("countrycodes","vn");
  url.searchParams.set("viewbox","103.75,10.55,104.25,9.80");
  url.searchParams.set("bounded","1");
  const response=await fetch(url,{
    headers:{
      "User-Agent":"OpenPhuQuoc/1.0 (https://openphuquoc.com)",
      "Accept-Language":"vi,en;q=0.8"
    },
    signal:AbortSignal.timeout(12000)
  });
  if(!response.ok)throw new Error("Nominatim HTTP "+response.status);
  const payload=await response.json();
  const candidates=(payload||[]).map(r=>({
    resolver:"OSM_NOMINATIM",
    source_id:"osm_nominatim_geocode",
    source:"OpenStreetMap Nominatim address geocoding",
    place_id:r.place_id||null,
    osm_type:r.osm_type||null,
    osm_id:r.osm_id||null,
    name:r.namedetails?.name||r.name||null,
    formatted_address:r.display_name||null,
    lat:Number(r.lat),
    lon:Number(r.lon),
    class:r.class||null,
    type:r.type||null,
    query_kind:queryKind
  }));
  const result=pickCandidate(entity,candidates,queryKind);
  await sleep(1100);
  return result||null;
}

async function nominatimSearch(entity){
  if(!entity.address)return null;
  const cleaned=cleanLegacyAddress(entity.address);
  const queries=[
    {kind:"name",q:[entity.name,"Phú Quốc","Việt Nam"].filter(Boolean).join(", ")},
    {kind:"address",q:[cleaned,"Phú Quốc","Việt Nam"].filter(Boolean).join(", ")}
  ];
  const seen=new Set();
  for(const item of queries){
    if(seen.has(item.q))continue;
    seen.add(item.q);
    try{
      const result=await nominatimQuery(entity,item.q,item.kind);
      if(result)return result;
    }catch(error){
      console.warn("WARN Nominatim query",entity.id,item.q,error.message);
    }
  }
  return null;
}

async function photonSearch(entity){
  const cleaned=cleanLegacyAddress(entity.address);
  const queries=[
    {kind:"name",q:[entity.name,"Phu Quoc","Vietnam"].filter(Boolean).join(", ")},
    {kind:"address",q:[cleaned,"Phu Quoc","Vietnam"].filter(Boolean).join(", ")}
  ];
  const seen=new Set();
  for(const item of queries){
    if(seen.has(item.q))continue;
    seen.add(item.q);
    try{
      const url=new URL("https://photon.komoot.io/api/");
      url.searchParams.set("q",item.q);
      url.searchParams.set("limit","8");
      url.searchParams.set("lat","10.227");
      url.searchParams.set("lon","103.967");
      const response=await fetch(url,{
        headers:{"User-Agent":"OpenPhuQuoc/1.0 (https://openphuquoc.com)"},
        signal:AbortSignal.timeout(12000)
      });
      if(!response.ok)continue;
      const payload=await response.json();
      const candidates=(payload.features||[]).map(feature=>{
        const p=feature.properties||{};
        return{
          resolver:"OSM_PHOTON",
          source_id:"osm_photon_geocode",
          source:"OpenStreetMap Photon location geocoding",
          place_id:null,
          osm_type:p.osm_type||null,
          osm_id:p.osm_id||null,
          name:p.name||null,
          formatted_address:[p.housenumber,p.street,p.district,p.city,p.county,p.state,p.country].filter(Boolean).join(", "),
          lat:Number(feature.geometry?.coordinates?.[1]),
          lon:Number(feature.geometry?.coordinates?.[0]),
          class:p.osm_key||null,
          type:p.osm_value||null,
          query_kind:item.kind
        };
      });
      const result=pickCandidate(entity,candidates,item.kind);
      if(result)return result;
    }catch(error){
      console.warn("WARN Photon",entity.id,item.q,error.message);
    }
  }
  return null;
}

async function resolveEntity(entity){
  const query=queryFor(entity);
  let match=null;
  if(apiKey){
    try{match=await googlePlaceSearch(query)}catch(error){
      console.warn("WARN Google Places",entity.id,error.message);
    }
    if(!match&&entity.address){
      try{match=await googleGeocode([entity.name,entity.address,"Phú Quốc, An Giang, Việt Nam"].filter(Boolean).join(", "))}catch(error){
        console.warn("WARN Google Geocode",entity.id,error.message);
      }
    }
  }
  if(!match&&entity.address){
    try{match=await nominatimSearch(entity)}catch(error){
      console.warn("WARN Nominatim",entity.id,error.message);
    }
  }
  if(!match&&entity.address){
    try{match=await photonSearch(entity)}catch(error){
      console.warn("WARN Photon",entity.id,error.message);
    }
  }
  return {query,match};
}

const files=fs.readdirSync(entityDir).filter(x=>x.endsWith(".json")).sort();
let attempted=0,resolved=0,changedFiles=0,skipped=0,missed=0;
const resolverCounts={};

for(const file of files){
  if(attempted>=limit)break;
  const filePath=path.join(entityDir,file);
  const data=JSON.parse(fs.readFileSync(filePath,"utf8"));
  let changed=false;

  for(const entity of data.entities||[]){
    if(attempted>=limit)break;
    if(!["utility","place","hotel"].includes(entity.entity_type))continue;
    if(!entity.address)continue;

    const hasMap=Number.isFinite(entity.map?.lat)&&Number.isFinite(entity.map?.lon);
    if(hasMap&&!force){skipped++;continue;}

    attempted++;
    const {query,match}=await resolveEntity(entity);
    if(!match){
      missed++;
      console.warn("MISS",entity.id,query);
      continue;
    }

    const precision=match.resolver.startsWith("GOOGLE")
      ? precisionForGoogleTypes(match.types||[])
      : precisionForNominatim(match,entity);

    entity.map={
      lat:match.lat,
      lon:match.lon,
      precision,
      source_id:match.source_id,
      source:match.source,
      verified_at:TODAY,
      accuracy:match.resolver,
      place_id:match.place_id,
      google_place_id:match.resolver.startsWith("GOOGLE")?match.place_id:null,
      osm_type:match.osm_type||null,
      osm_id:match.osm_id||null,
      matched_name:match.name,
      formatted_address:match.formatted_address,
      lookup_query:query,
      location_type:match.location_type||null,
      note:precision==="area_anchor"
        ?"Kết quả geocode ở mức khu vực; dùng để định hướng, không giả là cửa vào chính xác."
        :precision==="route_anchor"
          ?"Địa điểm chưa có pin cơ sở đủ chắc; đang neo theo đúng tuyến đường/khu lân cận từ địa chỉ."
          :"Tọa độ khớp tên/loại địa điểm và được lưu lại để dùng chung trên các bản đồ."
    };
    entity.updated_at=TODAY;
    changed=true;
    resolved++;
    resolverCounts[match.resolver]=(resolverCounts[match.resolver]||0)+1;
    console.log("OK",entity.id,match.resolver,match.lat,match.lon,precision,match.formatted_address||"");
  }

  if(changed){
    changedFiles++;
    if(!dryRun)fs.writeFileSync(filePath,JSON.stringify(data,null,2)+"\n");
  }
}

console.log(JSON.stringify({
  google_key_available:!!apiKey,
  attempted,
  resolved,
  missed,
  skipped_existing:skipped,
  changed_files:changedFiles,
  resolver_counts:resolverCounts,
  dry_run:dryRun
},null,2));
