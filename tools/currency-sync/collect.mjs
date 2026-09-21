import fs from "node:fs";
import path from "node:path";
import { parseVcbXml } from "../../workers/currency/src/index.js";

const ROOT=process.cwd();
const SNAPSHOT=path.join(ROOT,"data","currency-snapshot.json");
const HISTORY=path.join(ROOT,"data","currency-history.json");
const VCB_XML="https://portal.vietcombank.com.vn/Usercontrols/TVPortal.TyGia/pXML.aspx";

function readJson(file,fallback){
  try{return JSON.parse(fs.readFileSync(file,"utf8"));}catch{return fallback;}
}

const response=await fetch(VCB_XML,{
  headers:{
    "accept":"application/xml,text/xml;q=0.9,*/*;q=0.8",
    "user-agent":"OpenPhuQuoc-Currency-AutoSync/1.0"
  }
});
if(!response.ok) throw new Error("VCB_HTTP_"+response.status);

const xml=await response.text();
const payload=parseVcbXml(xml);
if(!payload.source_updated_at) throw new Error("VCB_SOURCE_TIME_MISSING");
if(!payload.rates?.length) throw new Error("VCB_RATES_EMPTY");

const previous=readJson(SNAPSHOT,{});
if(previous.source_updated_at===payload.source_updated_at && Array.isArray(previous.rates) && previous.rates.length){
  console.log("Currency unchanged:",payload.source_updated_at,payload.rates.length,"rates");
  process.exit(0);
}

payload.data_status="live";
payload.message="Tỷ giá Vietcombank được Open Phu Quoc đồng bộ tự động từ feed chính thức.";
fs.writeFileSync(SNAPSHOT,JSON.stringify(payload,null,2)+"\n");

const history=readJson(HISTORY,{schema_version:"1.0",source:"vietcombank",generated_at:null,points:[]});
const points=Array.isArray(history.points)?history.points:[];
const existing=new Set(points.map(p=>String(p.at)+"|"+String(p.currency)));
for(const row of payload.rates){
  const key=payload.source_updated_at+"|"+row.currency;
  if(existing.has(key)) continue;
  points.push({
    at:payload.source_updated_at,
    currency:row.currency,
    cash_buy:row.cash_buy,
    transfer_buy:row.transfer_buy,
    sell:row.sell
  });
}

const cutoff=Date.now()-400*86400000;
history.schema_version="1.0";
history.source="vietcombank";
history.generated_at=new Date().toISOString();
history.points=points
  .filter(p=>{
    const t=new Date(p.at).getTime();
    return Number.isFinite(t) && t>=cutoff;
  })
  .sort((a,b)=>new Date(a.at)-new Date(b.at) || String(a.currency).localeCompare(String(b.currency)));

fs.writeFileSync(HISTORY,JSON.stringify(history,null,2)+"\n");
console.log("Currency snapshot updated:",payload.source_updated_at,payload.rates.length,"rates,",history.points.length,"history points");
