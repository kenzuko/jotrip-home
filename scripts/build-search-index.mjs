import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const entityDir=path.join(root,"data","entities");
const files=fs.readdirSync(entityDir).filter(name=>name.endsWith(".json")).sort();

function fold(value){
  return String(value||"")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .replace(/đ/g,"d")
    .replace(/Đ/g,"D")
    .toLowerCase();
}

function routeFor(e){
  if(e.entity_type==="zone") return "/explore/?zone="+encodeURIComponent(e.id);
  if(e.entity_type==="place"||e.entity_type==="activity") return "/places/?q="+encodeURIComponent(e.slug||e.name);
  if(e.entity_type==="food") return "/food/article.html?id="+encodeURIComponent(e.legacy_id||e.slug);
  if(e.entity_type==="utility"){
    return ["utility_112","utility_113","utility_114","utility_115"].includes(e.id)
      ? "/utilities/#emergency"
      : "/utilities/#directory";
  }
  if(e.entity_type==="price_reference") return "/utilities/#prices";
  if(e.entity_type==="access"){
    if(e.id==="access_air") return "/airport/";
    if(e.id==="access_fast_boat"||e.id==="access_ferry") return "/ferry/";
  }
  return "/guide/?q="+encodeURIComponent(e.name)+"#search";
}

function toDoc(e){
  const bits=[
    e.name,
    ...(e.aliases||[]),
    ...(e.categories||[]),
    ...(e.intents||[]),
    ...(e.best_for||[]),
    e.what_it_is,
    e.why_go,
    e.phone,
    e.group,
    e.area_label,
    e.period,
    e.year,
    e.price_reference
  ].filter(Boolean);

  return {
    id:e.id,
    type:e.entity_type,
    title:e.name,
    aliases:e.aliases||[],
    zone_id:e.zone_id||null,
    intents:e.intents||[],
    route:routeFor(e),
    search_text:fold(bits.join(" "))
  };
}

const entities=[];
for(const file of files){
  const payload=JSON.parse(fs.readFileSync(path.join(entityDir,file),"utf8"));
  entities.push(...(payload.entities||[]));
}

const documents=entities.map(toDoc);
documents.push(
  {id:"live_weather",type:"live",title:"Thời tiết & biển Phú Quốc",aliases:["weather","mưa","gió","sóng","biển"],zone_id:null,intents:["weather","marine"],route:"/weather/",search_text:"thoi tiet weather mua gio song bien marine"},
  {id:"live_airport",type:"live",title:"Sân bay Phú Quốc",aliases:["airport","PQC","flight","chuyến bay"],zone_id:null,intents:["airport","arrival","departure"],route:"/airport/",search_text:"san bay airport pqc flight chuyen bay den di"},
  {id:"live_transport",type:"live",title:"Tàu, phà & di chuyển",aliases:["ferry","bus","transport","tàu","phà"],zone_id:null,intents:["transport"],route:"/ferry/",search_text:"tau pha ferry bus transport di chuyen rach gia ha tien"}
);

documents.sort((a,b)=>String(a.title).localeCompare(String(b.title),"vi"));

const output={
  schema_version:"1.3",
  generated_at:new Date().toISOString(),
  documents
};

fs.writeFileSync(
  path.join(root,"data","views","search-index.json"),
  JSON.stringify(output,null,2)+"\n"
);

console.log("Built search index:",documents.length,"documents from",files.length,"entity files");
