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
// Retain all previously collected daily aggregates. Monthly/yearly summaries are
// SQL GROUP BY projections of this immutable historical source: no stale caches,
// double-counting on deploy, or destructive backfill migrations.
const CHANNELS=new Set(["all","direct","internal","search","ai","social","referral"]);
const DEVICE_FILTERS=new Set(["all","desktop","mobile","tablet","other"]);
const PAGE_GROUPS=new Set(["all","home","guide","stories","go","nearme","weather","airport","transit","other"]);
const SORTS={
  hits_desc:"hits DESC, label ASC",hits_asc:"hits ASC, label ASC",
  name_asc:"label COLLATE NOCASE ASC",name_desc:"label COLLATE NOCASE DESC"
};
const GROUP_CASE="CASE WHEN path='/' THEN 'home' WHEN path LIKE '/guide/%' THEN 'guide' WHEN path LIKE '/stories/%' THEN 'stories' WHEN path LIKE '/go/%' THEN 'go' WHEN path LIKE '/nearme/%' THEN 'nearme' WHEN path LIKE '/weather/%' THEN 'weather' WHEN path LIKE '/airport/%' THEN 'airport' WHEN path LIKE '/transit/%' OR path LIKE '/ferry/%' OR path LIKE '/bus/%' THEN 'transit' ELSE 'other' END";
const ERR={error:"Bộ lọc không hợp lệ. Hãy chọn lại ngày hoặc bộ lọc."};
const numeric=x=>Number(x)||0;
const isoDay=s=>isDay(s)&&new Date(s+"T00:00:00Z").toISOString().slice(0,10)===s;
const shift=(day,days)=>dayMinus(day,-days);
const inclusiveDays=(from,to)=>Math.round((Date.parse(to+"T00:00:00Z")-Date.parse(from+"T00:00:00Z"))/86400000)+1;
const csvCell=value=>{
  const s=String(value??"");
  // Prevent Excel/Calc formula injection and ensure quoted CSV is unambiguous.
  const safe=/^[\s]*[=+\-@\t\r]/.test(s)?"'"+s:s;
  return '"'+safe.replace(/"/g,'""')+'"';
};
export function resolveTrafficPeriod(searchParams,today,firstDay){
  const explicit=searchParams.has("from")||searchParams.has("to");
  const period=searchParams.get("period")||(explicit?"custom":"7d");
  if(!["7d","30d","90d","365d","all","custom"].includes(period))return null;
  const to=period==="custom"?searchParams.get("to"):today;
  let from=period==="custom"?searchParams.get("from"):period==="all"?(firstDay||today):dayMinus(today,Number.parseInt(period,10)-1);
  if(period==="custom"&&(!from||!to))return null;
  if(!isoDay(from)||!isoDay(to)||from>to||to>today)return null;
  if(from<"2020-01-01")return null; // Guard accidental century-wide scans.
  const days=inclusiveDays(from,to);
  let grain=searchParams.get("group")||"auto";
  if(!["auto","day","month","year"].includes(grain))return null;
  if(grain==="auto")grain=days>730?"year":days>90?"month":"day";
  // Protect D1 and the browser from an unbounded daily timeseries.
  if(grain==="day"&&days>400)return null;
  const channel=searchParams.get("channel")||"all";
  const country=(searchParams.get("country")||"all").toUpperCase();
  const device=searchParams.get("device")||"all";
  const pageGroup=searchParams.get("page_group")||"all";
  const sort=searchParams.get("sort")||"hits_desc";
  const q=(searchParams.get("q")||"").trim();
  if(!CHANNELS.has(channel)||!DEVICE_FILTERS.has(device)||!PAGE_GROUPS.has(pageGroup)||!Object.hasOwn(SORTS,sort)
    ||country!=="ALL"&&!/^[A-Z]{2}$/.test(country)||q.length>80)return null;
  const compare=period!=="all"&&period!=="custom"?true:searchParams.get("compare")==="1";
  return {from,to,period,days,grain,channel,country,device,pageGroup,sort,q,compare};
}
async function firstTrafficDay(db){
  const result=await db.prepare("SELECT MIN(day) AS first_day FROM web_traffic_daily").first();
  return isoDay(result?.first_day)?result.first_day:null;
}
function clause(filter,from=filter.from,to=filter.to){
  const args=[from,to],where=["day BETWEEN ? AND ?"];
  if(filter.channel!=="all"){where.push("channel=?");args.push(filter.channel)}
  if(filter.country!=="ALL"){where.push("country=?");args.push(filter.country)}
  if(filter.device!=="all"){where.push("device=?");args.push(filter.device)}
  if(filter.pageGroup!=="all"){where.push(GROUP_CASE+"=?");args.push(filter.pageGroup)}
  if(filter.q){where.push("path LIKE ? ESCAPE '\\'");args.push("%"+filter.q.replace(/[\\%_]/g,"\\$&")+"%")}
  return{where:where.join(" AND "),args};
}
async function fetchRows(db,sql,args){
  const result=await db.prepare(sql).bind(...args).all();
  return(result.results||[]).map(row=>Object.fromEntries(Object.entries(row).map(([k,v])=>[k,k==="hits"?numeric(v):v])));
}
function timeKey(grain){
  return grain==="month"?"substr(day,1,7)":grain==="year"?"substr(day,1,4)":"day";
}
async function aggregates(db,filter,full=false){
  const {where,args}=clause(filter),view=where+" AND event='page_view'";
  const groupOrder=SORTS[filter.sort];
  const run=(sql,a=args)=>fetchRows(db,sql,a);
  const trendSql="SELECT "+timeKey(filter.grain)+" AS period,SUM(hits) hits FROM web_traffic_daily WHERE "+view+" GROUP BY period ORDER BY period ASC";
  const pageLimit=full?"":" LIMIT 50";
  const queries={
    trend:trendSql,
    pages:"SELECT path AS label,SUM(hits) hits FROM web_traffic_daily WHERE "+view+" GROUP BY path ORDER BY "+groupOrder+pageLimit,
    channels:"SELECT channel AS label,SUM(hits) hits FROM web_traffic_daily WHERE "+view+" GROUP BY channel ORDER BY "+groupOrder,
    referrers:"SELECT ref_domain AS label,SUM(hits) hits FROM web_traffic_daily WHERE "+view+" AND ref_domain!='' GROUP BY ref_domain ORDER BY "+groupOrder+(full?"":" LIMIT 50"),
    countries:"SELECT country AS label,SUM(hits) hits FROM web_traffic_daily WHERE "+view+" GROUP BY country ORDER BY "+groupOrder,
    devices:"SELECT device AS label,SUM(hits) hits FROM web_traffic_daily WHERE "+view+" GROUP BY device ORDER BY "+groupOrder,
    actions:"SELECT event AS label,SUM(hits) hits FROM web_traffic_daily WHERE "+where+" AND event!='page_view' GROUP BY event ORDER BY "+groupOrder,
    pageGroups:"SELECT "+GROUP_CASE+" AS label,SUM(hits) hits FROM web_traffic_daily WHERE "+view+" GROUP BY label ORDER BY "+groupOrder
  };
  const keys=Object.keys(queries);
  const responses=await Promise.all(keys.map(key=>run(queries[key])));
  const result=Object.fromEntries(keys.map((k,i)=>[k,responses[i]]));
  result.total_page_views=result.trend.reduce((s,row)=>s+row.hits,0);
  result.total_actions=result.actions.reduce((s,row)=>s+row.hits,0);
  return result;
}
async function previousPeriod(db,filter,firstDay,current){
  if(!filter.compare)return null;
  const prevTo=dayMinus(filter.from,1),prevFrom=dayMinus(filter.from,filter.days);
  // A baseline partially predating instrumented history must not be compared
  // as if its missing days were true zero traffic.
  if(!firstDay||firstDay>prevFrom)
    return {available:false,from:prevFrom,to:prevTo,reason:"Chưa đủ dữ liệu của kỳ trước"};
  const {where,args}=clause(filter,prevFrom,prevTo);
  const data=await fetchRows(db,"SELECT event,SUM(hits) hits FROM web_traffic_daily WHERE "+where+" GROUP BY event",args);
  const views=data.find(r=>r.event==="page_view")?.hits||0;
  const actions=data.filter(r=>r.event!=="page_view").reduce((s,r)=>s+r.hits,0);
  return {available:true,from:prevFrom,to:prevTo,page_views:views,actions,
    page_views_change_pct:views?Math.round((current.total_page_views-views)/views*1000)/10:null,
    actions_change_pct:actions?Math.round((current.total_actions-actions)/actions*1000)/10:null};
}
async function exportTrafficCsv(db,filter){
  const {where,args}=clause(filter);
  // Export the actual retained aggregate rows (not only the top-50 report).
  // Refuse overlarge downloads instead of silently truncating historical data.
  const limit=20001;
  const rows=await fetchRows(db,"SELECT day,event,path,channel,ref_domain,country,device,hits FROM web_traffic_daily WHERE "+where+
    " ORDER BY day ASC,event ASC,path ASC LIMIT "+limit,args);
  if(rows.length>=limit)return json({error:"Bản xuất vượt 20.000 dòng. Chọn khoảng thời gian ngắn hơn để tải đủ dữ liệu, tránh mất dòng."},413);
  const columns=["day","event","path","channel","ref_domain","country","device","hits"];
  const csv="\uFEFF"+columns.map(csvCell).join(",")+"\r\n"+rows.map(row=>columns.map(key=>csvCell(row[key])).join(",")).join("\r\n")+"\r\n";
  return new Response(csv,{status:200,headers:{
    "Content-Type":"text/csv; charset=utf-8",
    "Content-Disposition":'attachment; filename="openpq-traffic-'+filter.from+'-'+filter.to+'.csv"',
    "Cache-Control":"private, no-store","X-Robots-Tag":"noindex","X-Content-Type-Options":"nosniff"
  }});
}
export async function trafficReport(request,env){
  if(request.method!=="GET")return json({error:"Method not allowed"},405);
  const db=dbFrom(env);
  if(!db)return json({ready:false,error:"D1 chưa được cấu hình"},503);
  try{
    await ensure(db);
    const first_day=await firstTrafficDay(db),today=dayVN();
    const url=new URL(request.url),filter=resolveTrafficPeriod(url.searchParams,today,first_day);
    if(!filter)return json(ERR,400);
    const format=url.searchParams.get("format")||"json";
    if(format!=="json"&&format!=="csv")return json(ERR,400);
    if(format==="csv")return exportTrafficCsv(db,filter);
    const data=await aggregates(db,filter);
    const comparison=await previousPeriod(db,filter,first_day,data);
    return json({
      ready:true,first_day,from:filter.from,to:filter.to,period:filter.period,
      grain:filter.grain,filters:{channel:filter.channel,country:filter.country,device:filter.device,page_group:filter.pageGroup,q:filter.q,sort:filter.sort},
      updated_at:new Date().toISOString(),comparison,...data,
      // Preserve the established keys while the Admin dashboard migrates.
      pages:data.pages.map(r=>({path:r.label,hits:r.hits})),
      channels:data.channels.map(r=>({channel:r.label,hits:r.hits})),
      referrers:data.referrers.map(r=>({ref_domain:r.label,hits:r.hits})),
      countries:data.countries.map(r=>({country:r.label,hits:r.hits})),
      devices:data.devices.map(r=>({device:r.label,hits:r.hits})),
      actions:data.actions.map(r=>({event:r.label,hits:r.hits})),
      note:"Lượt xem và tương tác tổng hợp từ khi bắt đầu đo lường. Không lưu IP, GPS, cookie hay danh tính khách. Lưu D1 không tự xóa theo tuổi; tải CSV định kỳ để có thêm bản sao. Không phải số người duy nhất; AI chỉ nhận diện khi trình duyệt gửi nguồn."
    });
  }catch(error){console.warn("Traffic long-term report failed",error);return json({ready:false,error:"Chưa lấy được dữ liệu truy cập"},503)}
}
