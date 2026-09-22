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
  if(e.entity_type==="place"||e.entity_type==="activity") return "/places/detail.html?id="+encodeURIComponent(e.slug||e.id);
  if(e.entity_type==="food") return "/food/article.html?id="+encodeURIComponent(e.legacy_id||e.slug);
  if(e.entity_type==="hotel") return "/hotels/?hotel="+encodeURIComponent(e.slug||e.id);
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
    e.star_label,
    e.status_label,
    e.operational_status,
    e.address,
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
    star_rating:e.star_rating??null,
    operational_status:e.operational_status||null,
    related_entities:e.related_entities||[],
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

let storyDocs=[];
let curiosityDocs=[];
try{
  const content=JSON.parse(fs.readFileSync(path.join(root,"data","content.json"),"utf8"));
  storyDocs=(content.stories||[]).map(s=>({
    id:"story_"+s.id,type:"story",title:s.title,aliases:[],zone_id:null,intents:["story"],related_entities:[],
    route:"/stories/article.html?id="+encodeURIComponent(s.id),
    search_text:fold([s.title,s.dek,s.intro,s.category].filter(Boolean).join(" "))
  }));
}catch(error){}
try{
  const support=JSON.parse(fs.readFileSync(path.join(root,"data","home-support.json"),"utf8"));
  curiosityDocs=(support.curiosity||[]).map(x=>({
    id:"lore_"+x.prompt_id,type:"lore",title:x.question,aliases:[],zone_id:null,intents:["lore","curiosity"],
    related_entities:x.place_id?[x.place_id]:[],
    route:"/"+String(x.route||"stories/").replace(/^\//,""),
    search_text:fold([x.question,x.short_teaser,x.story_type].filter(Boolean).join(" "))
  }));
}catch(error){}
documents.push(...storyDocs,...curiosityDocs);
const knowledgeView=JSON.parse(fs.readFileSync(path.join(root,"data","views","knowledge-public.json"),"utf8"));
const knowledgeDocs=(knowledgeView.objects||[]).map(o=>({
  id:o.topic_id,
  type:"knowledge",
  title:o.title,
  aliases:[],
  zone_id:null,
  intents:["knowledge",o.topic_type.toLowerCase()],
  related_entities:o.related_entity_ids||[],
  route:o.route,
  summary:o.editorial.short_summary,
  search_text:fold([o.title,o.editorial.short_summary,o.editorial.practical,o.editorial.expectation_vs_reality,...o.editorial.before_you_go].join(" "))
}));
documents.unshift(...knowledgeDocs);
documents.push(
  {id:"live_weather",type:"live",title:"Thời tiết & biển Phú Quốc",aliases:["weather","mưa","gió","sóng","biển"],zone_id:null,intents:["weather","marine"],route:"/weather/",search_text:"thoi tiet weather mua gio song bien marine"},
  {id:"live_airport",type:"live",title:"Sân bay Phú Quốc",aliases:["airport","PQC","flight","chuyến bay"],zone_id:null,intents:["airport","arrival","departure"],route:"/airport/",search_text:"san bay airport pqc flight chuyen bay den di"},
  {id:"live_transport",type:"live",title:"Tàu, phà & di chuyển",aliases:["ferry","bus","transport","tàu","phà"],zone_id:null,intents:["transport"],route:"/ferry/",search_text:"tau pha ferry bus transport di chuyen rach gia ha tien"},
  {id:"live_currency",type:"currency",title:"Tỷ giá & đổi tiền",aliases:["currency","exchange rate","tỷ giá","đổi tiền","usd","krw","won","cny","rmb","rub","eur","jpy"],zone_id:null,intents:["currency","utility"],route:"/currency/",search_text:"ty gia doi tien currency exchange rate usd dollar do krw won cny rmb yuan rub ruble eur euro jpy yen vnd vietcombank"}
  ,{id:"live_south_weather",type:"live",title:"Thời tiết Nam đảo",aliases:["thời tiết Hòn Thơm","thời tiết An Thới","sóng Nam đảo"],zone_id:"zone_south",intents:["weather","marine","south"],related_entities:["activity_hon_thom","activity_tour_3_islands","activity_snorkeling_an_thoi"],route:"/weather/",search_text:"thoi tiet nam dao hon thom an thoi song gio mua bien"}
);

documents.sort((a,b)=>String(a.title).localeCompare(String(b.title),"vi"));

const output={
  schema_version:"1.5",
  generated_at:new Date().toISOString(),
  documents
};

fs.writeFileSync(
  path.join(root,"data","views","search-index.json"),
  JSON.stringify(output,null,2)+"\n"
);

console.log("Built search index:",documents.length,"documents from",files.length,"entity files");
