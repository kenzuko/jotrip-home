// Open Phu Quoc traffic: anonymous, aggregated and owner-only on the reporting side.
// We never retain IP, GPS, session IDs, user agents, raw URLs, search text or cookies.
const EVENT_TYPES=new Set(["page_view","go_open","nearme_open","weather_open","airport_open","transit_open","feedback_open"]);
const DEVICES=new Set(["desktop","mobile","tablet","other"]);
const BASE_HOST="cms.openphuquoc.com";
const headers={"Content-Type":"application/json; charset=utf-8","Cache-Control":"private, no-store","X-Robots-Tag":"noindex"};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
const dayVN=()=>new Date(Date.now()+7*3600000).toISOString().slice(0,10);
const isDay=s=>typeof s==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+"T00:00:00Z"));
const dayMinus=(day,n)=>new Date(Date.parse(day+"T00:00:00Z")-n*86400000).toISOString().slice(0,10);
const dbFrom=env=>env.TRAFFIC_DB||env.CMS_DB||null;
const pathPattern=/^\/[a-z0-9_./-]{0,130}(?:\?id=[a-z0-9_-]{1,80})?$/i;
const hostnamePattern=/^(?:[a-z0-9-]+\.)*[a-z0-9-]+\.[a-z]{2,}$/i;
function sourceDomain(host){
  const known=["chatgpt.com","openai.com","perplexity.ai","gemini.google.com","claude.ai","copilot.microsoft.com","poe.com","facebook.com","instagram.com","tiktok.com","youtube.com","reddit.com","x.com","twitter.com","zalo.me","google.com","google.com.vn","bing.com","yahoo.com","duckduckgo.com","naver.com","baidu.com","yandex.ru","yandex.com"];
  for(const domain of known)if(host===domain||host.endsWith("."+domain))return domain;
  if(/(^|\.)google\./.test(host))return "google";
  if(/(^|\.)yandex\./.test(host))return "yandex";
  if(host===BASE_HOST||host==="openphuquoc.com"||host.endsWith(".openphuquoc.com"))return "openphuquoc.com";
  return "other";
}
function classify(domain){
  if(!domain)return "direct";
  if(domain==="openphuquoc.com")return "internal";
  if(["chatgpt.com","openai.com","perplexity.ai","gemini.google.com","claude.ai","copilot.microsoft.com","poe.com"].includes(domain))return "ai";
  if(["facebook.com","instagram.com","tiktok.com","youtube.com","reddit.com","x.com","twitter.com","zalo.me"].includes(domain))return "social";
  if(["google.com","google.com.vn","google","bing.com","yahoo.com","duckduckgo.com","naver.com","baidu.com","yandex.ru","yandex.com","yandex"].includes(domain))return "search";
  return "referral";
}
export function normalizeEvent(input,country="XX"){
  if(!input||typeof input!=="object"||Array.isArray(input))return null;
  const event=String(input.event||"");
  const path=String(input.path||"");
  if(!EVENT_TYPES.has(event)||!pathPattern.test(path)||path.includes(".."))return null;
  if(/^\/(?:admin|api|cms)(?:\/|$)/i.test(path)||/^\/weather\/analytics/i.test(path))return null;
  const raw=String(input.referrer||"").trim().toLowerCase();
  const host=raw.length<=90&&hostnamePattern.test(raw)?raw:"";
  const ref_domain=host?sourceDomain(host):"";
  const channel=classify(ref_domain);
  const device=DEVICES.has(input.device)?input.device:"other";
  return {event,path,channel,ref_domain,country:/^[A-Z]{2}$/.test(country)?country:"XX",device};
}
const DDL="CREATE TABLE IF NOT EXISTS web_traffic_daily (day TEXT NOT NULL,event TEXT NOT NULL,path TEXT NOT NULL,channel TEXT NOT NULL,ref_domain TEXT NOT NULL,country TEXT NOT NULL,device TEXT NOT NULL,hits INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(day,event,path,channel,ref_domain,country,device))";
async function ensure(db){await db.prepare(DDL).run()}
export async function collectTraffic(request,env){
  if(request.method!=="POST")return json({error:"Method not allowed"},405);
  const url=new URL(request.url),origin=request.headers.get("origin");
  if(url.hostname!==BASE_HOST||origin!==url.origin)return json({error:"Origin not allowed"},403);
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type")||""))return json({error:"JSON required"},415);
  if(Number(request.headers.get("content-length")||0)>1024)return json({error:"Payload too large"},413);
  const ua=request.headers.get("user-agent")||"";
  if(/bot|spider|crawl|headless|facebookexternalhit|lighthouse|pagespeed/i.test(ua))
    return new Response(null,{status:204,headers:{"Cache-Control":"no-store"}});
  try{
    const payload=await request.text();
    if(payload.length>1024)return json({error:"Payload too large"},413);
    const event=normalizeEvent(JSON.parse(payload),request.cf?.country||"XX");
    if(!event)return json({error:"Invalid event"},400);
    const db=dbFrom(env);
    if(!db)return json({error:"Traffic storage unavailable"},503);
    await ensure(db);
    await db.prepare("INSERT INTO web_traffic_daily(day,event,path,channel,ref_domain,country,device,hits) VALUES(?,?,?,?,?,?,?,1) ON CONFLICT(day,event,path,channel,ref_domain,country,device) DO UPDATE SET hits=hits+1")
      .bind(dayVN(),event.event,event.path,event.channel,event.ref_domain,event.country,event.device).run();
    return new Response(null,{status:204,headers:{"Cache-Control":"no-store"}});
  }catch(error){console.warn("Traffic collector failed",error);return json({error:"Traffic unavailable"},503)}
}
export async function trafficReport(request,env){
  if(request.method!=="GET")return json({error:"Method not allowed"},405);
  const db=dbFrom(env);
  if(!db)return json({ready:false,error:"D1 chưa được cấu hình"},503);
  const url=new URL(request.url),today=dayVN();
  const from=url.searchParams.get("from")||dayMinus(today,6);
  const to=url.searchParams.get("to")||today;
  if(!isDay(from)||!isDay(to)||from>to||Date.parse(to)-Date.parse(from)>89*86400000||to>today)return json({error:"Chọn tối đa 90 ngày, không chọn ngày tương lai"},400);
  try{
    await ensure(db);
    const range=[from,to];
    const queries={
      trend:"SELECT day,SUM(hits) hits FROM web_traffic_daily WHERE event='page_view' AND day BETWEEN ? AND ? GROUP BY day ORDER BY day ASC",
      pages:"SELECT path,SUM(hits) hits FROM web_traffic_daily WHERE event='page_view' AND day BETWEEN ? AND ? GROUP BY path ORDER BY hits DESC LIMIT 20",
      channels:"SELECT channel,SUM(hits) hits FROM web_traffic_daily WHERE event='page_view' AND day BETWEEN ? AND ? GROUP BY channel ORDER BY hits DESC",
      referrers:"SELECT ref_domain,SUM(hits) hits FROM web_traffic_daily WHERE event='page_view' AND day BETWEEN ? AND ? AND ref_domain!='' GROUP BY ref_domain ORDER BY hits DESC LIMIT 15",
      countries:"SELECT country,SUM(hits) hits FROM web_traffic_daily WHERE event='page_view' AND day BETWEEN ? AND ? GROUP BY country ORDER BY hits DESC LIMIT 15",
      devices:"SELECT device,SUM(hits) hits FROM web_traffic_daily WHERE event='page_view' AND day BETWEEN ? AND ? GROUP BY device ORDER BY hits DESC",
      actions:"SELECT event,SUM(hits) hits FROM web_traffic_daily WHERE event!='page_view' AND day BETWEEN ? AND ? GROUP BY event ORDER BY hits DESC"
    };
    const names=Object.keys(queries);
    const rows=await Promise.all(names.map(n=>db.prepare(queries[n]).bind(...range).all()));
    const values=Object.fromEntries(names.map((name,i)=>[name,rows[i].results||[]]));
    const total_page_views=values.trend.reduce((sum,r)=>sum+Number(r.hits||0),0);
    return json({ready:true,from,to,updated_at:new Date().toISOString(),total_page_views,...values,
      note:"Thống kê tổng hợp từ khi bật đo lường. Không dùng cookie, không đếm khách duy nhất; nguồn AI chỉ hiện khi trình duyệt gửi referrer."});
  }catch(error){console.warn("Traffic report failed",error);return json({ready:false,error:"Chưa lấy được dữ liệu truy cập"},503)}
}
export async function cleanupTraffic(env){
  const db=dbFrom(env);if(!db)return;
  await ensure(db);
  await db.prepare("DELETE FROM web_traffic_daily WHERE day < ?").bind(dayMinus(dayVN(),180)).run();
}
