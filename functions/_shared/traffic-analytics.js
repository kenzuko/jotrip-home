// First-party privacy-conscious aggregate traffic. No IP, GPS, cookies or user identifiers.
const EVENTS=new Set(["page_view","go_open","nearme_open","weather_open","airport_open","transit_open","feedback_open"]);
const JSON_HEADERS={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:JSON_HEADERS});
const pathPattern=/^\/[a-z0-9_./-]{0,130}(?:\?id=[a-z0-9_-]{1,100})?$/i;
const hostnamePattern=/^(?:[a-z0-9-]+\.)*[a-z0-9-]+\.[a-z]{2,}$/i;
const deviceChoices=new Set(["mobile","tablet","desktop","other"]);
const nowDay=()=>new Date(Date.now()+7*3600000).toISOString().slice(0,10);
function channel(host){
  if(!host)return "direct";
  if(host==="openphuquoc.com"||host.endsWith(".openphuquoc.com"))return "internal";
  if(/(^|\.)google\./.test(host)||/(^|\.)bing\.com$/.test(host)||/(^|\.)yahoo\.com$/.test(host)||/(^|\.)duckduckgo\.com$/.test(host)||/(^|\.)naver\.com$/.test(host)||/(^|\.)baidu\.com$/.test(host)||/(^|\.)yandex\./.test(host))return "search";
  if(["chatgpt.com","chat.openai.com","perplexity.ai","gemini.google.com","claude.ai","copilot.microsoft.com","poe.com"].some(x=>host===x||host.endsWith("."+x)))return "ai";
  if(["facebook.com","instagram.com","tiktok.com","youtube.com","reddit.com","x.com","twitter.com","pinterest.com","threads.net","zalo.me"].some(x=>host===x||host.endsWith("."+x)))return "social";
  return "referral";
}
async function schema(db){
  await db.prepare("CREATE TABLE IF NOT EXISTS web_traffic_daily (day TEXT NOT NULL,event TEXT NOT NULL,path TEXT NOT NULL,channel TEXT NOT NULL,ref_domain TEXT NOT NULL,country TEXT NOT NULL,device TEXT NOT NULL,hits INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(day,event,path,channel,ref_domain,country,device))").run();
}
function dbFrom(env){return env.TRAFFIC_DB||env.CMS_DB||null}
export async function collectTraffic(request,env){
  if(request.method!=="POST")return json({error:"Method not allowed"},405);
  const origin=request.headers.get("origin");
  const target=new URL(request.url);
  if(origin!==target.origin)return json({error:"Origin not allowed"},403);
  if(!String(request.headers.get("content-type")||"").startsWith("application/json"))return json({error:"JSON required"},415);
  if(Number(request.headers.get("content-length")||0)>1024)return json({error:"Payload too large"},413);
  if(/bot|spider|crawler|headless|facebookexternalhit/i.test(request.headers.get("user-agent")||""))return new Response(null,{status:204,headers:{"Cache-Control":"no-store"}});
  const db=dbFrom(env);if(!db)return json({error:"Analytics storage unavailable"},503);
  try{
    const body=await request.text();if(body.length>1024)return json({error:"Payload too large"},413);
    const row=JSON.parse(body);
    const event=String(row.event||""),path=String(row.path||"");
    if(!EVENTS.has(event)||!pathPattern.test(path)||path.includes("..")||path.startsWith("/admin/")||path.startsWith("/api/"))return json({error:"Invalid event"},400);
    const rawHost=String(row.referrer||"").toLowerCase().slice(0,90);
    const host=hostnamePattern.test(rawHost)?rawHost:"";
    const source=channel(host);
    const dev=deviceChoices.has(row.device)?row.device:"other";
    const country=/^[A-Z]{2}$/.test(request.cf?.country||"")?request.cf.country:"XX";
    await schema(db);
    await db.prepare("INSERT INTO web_traffic_daily(day,event,path,channel,ref_domain,country,device,hits) VALUES(?,?,?,?,?,?,?,1) ON CONFLICT(day,event,path,channel,ref_domain,country,device) DO UPDATE SET hits=hits+1")
      .bind(nowDay(),event,path,source,host,country,dev).run();
    return new Response(null,{status:204,headers:{"Cache-Control":"no-store"}});
  }catch(error){console.warn("Traffic collector error",error);return json({error:"Analytics unavailable"},503);}
}
const validDay=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||"")&&!Number.isNaN(Date.parse(s+"T00:00:00Z"));
export async function trafficReport(request,env){
  const db=dbFrom(env);if(!db)return json({error:"D1 chưa được kết nối",ready:false},503);
  const u=new URL(request.url),today=nowDay();
  const from=u.searchParams.get("from")||new Date(Date.parse(today+"T00:00:00Z")-6*86400000).toISOString().slice(0,10);
  const to=u.searchParams.get("to")||today;
  if(!validDay(from)||!validDay(to)||from>to||Date.parse(to)-Date.parse(from)>89*86400000)return json({error:"Khoảng ngày không hợp lệ (tối đa 90 ngày)"},400);
  try{
    await schema(db);
    const [trend,pages,channels,countries,devices,events]=await Promise.all([
      db.prepare("SELECT day,SUM(hits) AS hits FROM web_traffic_daily WHERE event='page_view' AND day BETWEEN ? AND ? GROUP BY day ORDER BY day").bind(from,to).all(),
      db.prepare("SELECT path,SUM(hits) AS hits FROM web_traffic_daily WHERE event='page_view' AND day BETWEEN ? AND ? GROUP BY path ORDER BY hits DESC LIMIT 20").bind(from,to).all(),
      db.prepare("SELECT channel,SUM(hits) AS hits FROM web_traffic_daily WHERE event='page_view' AND day BETWEEN ? AND ? GROUP BY channel ORDER BY hits DESC").bind(from,to).all(),
      db.prepare("SELECT country,SUM(hits) AS hits FROM web_traffic_daily WHERE event='page_view' AND day BETWEEN ? AND ? GROUP BY country ORDER BY hits DESC LIMIT 15").bind(from,to).all(),
      db.prepare("SELECT device,SUM(hits) AS hits FROM web_traffic_daily WHERE event='page_view' AND day BETWEEN ? AND ? GROUP BY device ORDER BY hits DESC").bind(from,to).all(),
      db.prepare("SELECT event,SUM(hits) AS hits FROM web_traffic_daily WHERE event!='page_view' AND day BETWEEN ? AND ? GROUP BY event ORDER BY hits DESC").bind(from,to).all()
    ]);
    const values=r=>r.results||[];
    const total=values(trend).reduce((sum,r)=>sum+Number(r.hits||0),0);
    return json({ready:true,from,to,updated_at:new Date().toISOString(),total_page_views:total,
      note:"Số lượt xem và thao tác tổng hợp; không phải số người dùng duy nhất. Một số nguồn AI không gửi referrer.",
      trend:values(trend),pages:values(pages),channels:values(channels),countries:values(countries),devices:values(devices),events:values(events)});
  }catch(error){console.warn("Traffic report error",error);return json({error:"Chưa đọc được dữ liệu Analytics",ready:false},503);}
}
