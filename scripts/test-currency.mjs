import fs from "node:fs";
import { parseVcbXml, vcbTimeToIso } from "../workers/currency/src/index.js";

const iso=vcbTimeToIso("8/21/2026 2:42:34 PM");
if(iso!=="2026-08-21T14:42:34+07:00"){
  throw new Error("VCB US timestamp parse failed: "+iso);
}

const legacy=vcbTimeToIso("21/09/2026 07:58:00");
if(legacy!=="2026-09-21T07:58:00+07:00"){
  throw new Error("VCB DD/MM fallback parse failed: "+legacy);
}

const sample=`<!--For reference only. Only one request every 5 minutes!-->
<ExrateList>
  <DateTime>8/21/2026 2:42:34 PM</DateTime>
  <Exrate CurrencyCode="AUD" CurrencyName="AUSTRALIAN DOLLAR" Buy="18,130.53" Transfer="18,313.67" Sell="18,900.44" />
  <Exrate CurrencyCode="USD" CurrencyName="US DOLLAR" Buy="26,100.00" Transfer="26,130.00" Sell="26,460.00" />
</ExrateList>`;

const parsed=parseVcbXml(sample);
if(parsed.source_updated_at!=="2026-08-21T14:42:34+07:00") throw new Error("source_updated_at mismatch");
if(parsed.rates.length!==2) throw new Error("expected 2 rates");
const aud=parsed.rates.find(x=>x.currency==="AUD");
if(aud?.cash_buy!==18130.53 || aud?.transfer_buy!==18313.67 || aud?.sell!==18900.44){
  throw new Error("VCB numeric normalization failed");
}

console.log("Currency parser QA OK: timestamp formats, XML fields and comma-separated rates");


const history=JSON.parse(fs.readFileSync("data/currency-history.json","utf8"));
const daily=history.points.filter(point=>point.granularity==="daily");
const required=["USD","KRW","CNY","RUB","EUR"];
for(const code of required){
  const count=daily.filter(point=>point.currency===code).length;
  if(count<30) throw new Error("Currency history regression: "+code+" has only "+count+" daily points");
}
if(history.backfill?.calendar_days!==30) throw new Error("Currency history must retain 30-day official VCB backfill metadata");
console.log("Currency history QA OK: 30-day Vietcombank backfill retained for core currencies");

const dailyCodes=[...new Set(daily.map(point=>point.currency))].sort();
if(dailyCodes.includes("NAN")) throw new Error("Currency history contains synthetic NAN currency code");
if(dailyCodes.length!==20) throw new Error("Currency history expected 20 VCB currencies, got "+dailyCodes.length);
if(daily.length<600) throw new Error("Currency history expected at least 600 daily points, got "+daily.length);
console.log("Currency history hygiene QA OK: 20 real currencies, no synthetic codes");
