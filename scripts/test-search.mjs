import fs from "node:fs";
import vm from "node:vm";

const documents=JSON.parse(fs.readFileSync("data/views/search-index.json","utf8")).documents;
const context={
  window:{},
  fetch:async()=>({ok:true,json:async()=>({documents})})
};
vm.createContext(context);
vm.runInContext(fs.readFileSync("core/search-engine.js","utf8"),context);
await context.window.OpenPQSearch.load("memory");

const cases=[
  ["HB","meal_plan_hb"],
  ["gia hon thom","price_hon_thom_buffet"],
  ["cau hon","place_kiss_bridge"],
  ["visa","practical_visa"],
  ["Regent","hotel_regent"],
  ["tau cao toc","access_fast_boat"],
  ["APEC","history_apec_2027"],
  ["Kiss of the Sea","activity_kiss_of_the_sea"],
  ["ty gia usd","live_currency"]
];

for(const [query,expected] of cases){
  const first=context.window.OpenPQSearch.search(query,1)[0];
  if(first?.id!==expected) throw new Error(query+": expected "+expected+", got "+(first?.id||"none"));
}

const regent=context.window.OpenPQSearch.search("Regent",1)[0];
if(regent?.route!=="/hotels/?hotel=regent") throw new Error("Regent must route to canonical hotel directory");

const honThom=context.window.OpenPQSearch.searchGrouped("hon thom",10);
const groupMap=new Map(honThom.map(group=>[group.id,group.items.map(x=>x.id)]));
if(groupMap.get("main")?.[0]!=="activity_hon_thom") throw new Error("Hòn Thơm cluster missing canonical primary");
if(!groupMap.get("experience")?.includes("place_aquatopia")) throw new Error("Hòn Thơm cluster missing Aquatopia");
if(!groupMap.get("price")?.includes("price_hon_thom_day")) throw new Error("Hòn Thơm cluster missing day price");
if(!groupMap.get("live")?.includes("live_south_weather")) throw new Error("Hòn Thơm cluster missing South weather");

const currency=context.window.OpenPQSearch.search("100 USD",1)[0];
if(currency?.type!=="currency" || !currency?.route?.startsWith("/currency/?")) throw new Error("100 USD must create a currency quick route");

console.log("Search QA OK:",cases.length,"queries, currency quick route and Hòn Thơm entity cluster");
