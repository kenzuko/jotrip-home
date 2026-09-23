const SESSION_COOKIE="openpq_cms";
const te=new TextEncoder(),td=new TextDecoder();

const json=(data,status=200)=>new Response(JSON.stringify(data),{
  status,
  headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}
});

const parseCookies=req=>{
  const out={};
  for(const part of (req.headers.get("cookie")||"").split(";")){
    const i=part.indexOf("=");
    if(i>0) out[part.slice(0,i).trim()]=decodeURIComponent(part.slice(i+1).trim());
  }
  return out;
};

const fromB64=s=>{
  s=s.replace(/-/g,"+").replace(/_/g,"/");
  while(s.length%4)s+="=";
  const bin=atob(s);
  return Uint8Array.from(bin,c=>c.charCodeAt(0));
};

async function key(secret){
  const digest=await crypto.subtle.digest("SHA-256",te.encode(secret));
  return crypto.subtle.importKey("raw",digest,{name:"AES-GCM"},false,["decrypt"]);
}

async function session(req,secret){
  const token=parseCookies(req)[SESSION_COOKIE]||"";
  if(!token||!secret)return null;
  try{
    const [a,b]=token.split(".");
    if(!a||!b)return null;
    const k=await key(secret);
    const dec=await crypto.subtle.decrypt({name:"AES-GCM",iv:fromB64(a)},k,fromB64(b));
    const obj=JSON.parse(td.decode(dec));
    return obj.exp>Date.now()?obj:null;
  }catch{return null}
}

async function currentRole(login){
  const r=await fetch("https://raw.githubusercontent.com/kenzuko/jotrip-home/main/cms/users.json?v="+Date.now(),{
    headers:{"User-Agent":"Open-Phu-Quoc-CMS"},cache:"no-store"
  });
  if(!r.ok)throw new Error("Không kiểm tra được quyền CMS: HTTP "+r.status);
  const doc=await r.json();
  const u=(doc.users||[]).find(x=>String(x.login).toLowerCase()===String(login).toLowerCase()&&x.enabled!==false);
  return u?.role||null;
}

function dbFromEnv(env){
  return env.ANALYTICS_DB||env.CMS_DB||env.OPENPQ_DB||env.DATA_DB||env.DB||env.METRICS_DB||null;
}

async function ensureSchema(db){
  if(!db)return;
  const statements=[
    `CREATE TABLE IF NOT EXISTS analytics_sync (
      source TEXT PRIMARY KEY,
      last_attempt_at TEXT,
      last_success_at TEXT,
      status TEXT NOT NULL DEFAULT 'unknown',
      records INTEGER NOT NULL DEFAULT 0,
      message TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS transit_observations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      observed_at TEXT NOT NULL,
      service_date TEXT,
      operator TEXT NOT NULL,
      mode TEXT,
      origin TEXT,
      destination TEXT,
      departure_time TEXT,
      arrival_time TEXT,
      adult_fare INTEGER,
      currency TEXT,
      capacity_proxy REAL,
      remaining_proxy REAL,
      load_factor_proxy REAL,
      evidence_class TEXT NOT NULL DEFAULT 'observed',
      UNIQUE(observed_at,operator,origin,destination,departure_time)
    )`,
    "CREATE INDEX IF NOT EXISTS idx_transit_service_date ON transit_observations(service_date)",
    "CREATE INDEX IF NOT EXISTS idx_transit_route ON transit_observations(operator,origin,destination)",
    "CREATE INDEX IF NOT EXISTS idx_transit_observed ON transit_observations(observed_at)",
    `CREATE TABLE IF NOT EXISTS aviation_observations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      observed_at TEXT NOT NULL,
      service_date TEXT,
      direction TEXT,
      flight_number TEXT,
      airline TEXT,
      station TEXT,
      scheduled_time TEXT,
      status TEXT,
      delay_minutes INTEGER,
      capacity_proxy REAL,
      load_factor_proxy REAL,
      evidence_class TEXT NOT NULL DEFAULT 'observed',
      UNIQUE(observed_at,direction,flight_number,scheduled_time)
    )`,
    "CREATE INDEX IF NOT EXISTS idx_aviation_service_date ON aviation_observations(service_date)",
    "CREATE INDEX IF NOT EXISTS idx_aviation_observed ON aviation_observations(observed_at)",
    `CREATE TABLE IF NOT EXISTS sea_load_observations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      observed_at TEXT NOT NULL,
      service_date TEXT NOT NULL,
      operator TEXT NOT NULL,
      origin TEXT NOT NULL,
      destination TEXT NOT NULL,
      departure_time TEXT NOT NULL,
      vessel TEXT,
      capacity INTEGER,
      remaining INTEGER,
      load_factor REAL,
      load_basis TEXT NOT NULL,
      evidence_class TEXT NOT NULL,
      UNIQUE(observed_at,operator,origin,destination,departure_time)
    )`,
    "CREATE INDEX IF NOT EXISTS idx_sea_load_service_date ON sea_load_observations(service_date)",
    "CREATE INDEX IF NOT EXISTS idx_sea_load_route ON sea_load_observations(operator,origin,destination)",
    "CREATE INDEX IF NOT EXISTS idx_sea_load_departure ON sea_load_observations(departure_time)",
    `CREATE TABLE IF NOT EXISTS ops_observations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      observed_at TEXT NOT NULL,
      domain TEXT NOT NULL,
      metric TEXT NOT NULL,
      value_num REAL,
      value_text TEXT,
      evidence_class TEXT NOT NULL DEFAULT 'observed',
      UNIQUE(observed_at,domain,metric)
    )`,
    "CREATE INDEX IF NOT EXISTS idx_ops_observed ON ops_observations(observed_at)"
  ];
  await db.batch(statements.map(sql=>db.prepare(sql)));
}

function isoNow(){return new Date().toISOString()}

function datePart(value){
  const s=String(value||"");
  const m=s.match(/^\d{4}-\d{2}-\d{2}/);
  return m?m[0]:null;
}

function num(v){
  const n=Number(v);
  return Number.isFinite(n)?n:null;
}

async function lastSync(db,source){
  if(!db)return null;
  return db.prepare("SELECT * FROM analytics_sync WHERE source=?").bind(source).first();
}

function isFresh(sync,minutes=5){
  if(!sync?.last_success_at)return false;
  const t=new Date(sync.last_success_at).getTime();
  return Number.isFinite(t)&&Date.now()-t<minutes*60*1000;
}

async function markSync(db,source,status,records,message=""){
  if(!db)return;
  const now=isoNow();
  const success=status==="ok"?now:null;
  await db.prepare(`
    INSERT INTO analytics_sync(source,last_attempt_at,last_success_at,status,records,message)
    VALUES(?,?,?,?,?,?)
    ON CONFLICT(source) DO UPDATE SET
      last_attempt_at=excluded.last_attempt_at,
      last_success_at=CASE WHEN excluded.status='ok' THEN excluded.last_success_at ELSE analytics_sync.last_success_at END,
      status=excluded.status,
      records=excluded.records,
      message=excluded.message
  `).bind(source,now,success,status,records,message||null).run();
}

async function fetchJson(url,timeoutMs=6500){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const r=await fetch(url,{headers:{accept:"application/json","User-Agent":"OpenPQ-Analytics/1.0"},cache:"no-store",signal:controller.signal});
    if(!r.ok)throw new Error("HTTP "+r.status);
    return r.json();
  }finally{clearTimeout(timer)}
}

const PQE_ROUTES={
  1:["Rạch Giá","Phú Quốc"],
  2:["Phú Quốc","Rạch Giá"],
  3:["Hà Tiên","Phú Quốc"],
  4:["Phú Quốc","Hà Tiên"]
};
const SUPERDONG_ROUTES={
  3:["Hà Tiên","Phú Quốc"],
  4:["Phú Quốc","Hà Tiên"],
  5:["Rạch Giá","Phú Quốc"],
  6:["Phú Quốc","Rạch Giá"]
};
const PQE_CAPACITY_RULES=[
  {re:/\bPQE\s*18\b|PHÚ QUỐC EXPRESS\s*18/i,capacity:231,basis:"public_vessel_spec"},
  {re:/\bPQE\s*27\b|PHÚ QUỐC EXPRESS\s*27/i,capacity:231,basis:"public_vessel_spec"},
  {re:/\bPQE\s*9\b|PHÚ QUỐC EXPRESS\s*9/i,capacity:300,basis:"public_vessel_spec"}
];

function localDay(){
  const parts=new Intl.DateTimeFormat("en-CA",{
    timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit"
  }).formatToParts(new Date());
  const m=Object.fromEntries(parts.map(x=>[x.type,x.value]));
  return `${m.year}-${m.month}-${m.day}`;
}
function dateOnlyValid(v){return /^\d{4}-\d{2}-\d{2}$/.test(String(v||""))}
function addDays(day,n){
  const d=new Date(day+"T12:00:00Z");
  d.setUTCDate(d.getUTCDate()+n);
  return d.toISOString().slice(0,10);
}
function diffDays(a,b){
  return Math.max(0,Math.round((new Date(b+"T12:00:00Z")-new Date(a+"T12:00:00Z"))/86400000));
}
function isoLocal(day,hhmm){
  if(!hhmm)return null;
  const m=String(hhmm).match(/(\d{1,2}):(\d{2})/);
  if(!m)return null;
  return `${day}T${String(Number(m[1])).padStart(2,"0")}:${m[2]}:00+07:00`;
}
function capacityForPqe(name){
  const s=String(name||"");
  for(const rule of PQE_CAPACITY_RULES)if(rule.re.test(s))return rule;
  return {capacity:null,basis:"remaining_only"};
}
async function fetchJsonDetailed(url,params={},opts={}){
  const u=new URL(url);
  for(const [k,v] of Object.entries(params||{}))u.searchParams.set(k,String(v));
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),opts.timeoutMs||8000);
  try{
    const r=await fetch(u.toString(),{
      method:"GET",
      headers:{
        "accept":opts.accept||"application/json,text/plain,*/*",
        "user-agent":"Mozilla/5.0 OpenPQ-Internal-Analytics/1.0",
        ...(opts.headers||{})
      },
      cache:"no-store",
      signal:controller.signal
    });
    if(!r.ok)throw new Error("HTTP "+r.status+" "+u.pathname);
    return {data:await r.json(),headers:r.headers};
  }finally{clearTimeout(timer)}
}
async function collectPqeLoad(day){
  const rows=[];
  for(const [routeId,pair] of Object.entries(PQE_ROUTES)){
    const {data}=await fetchJsonDetailed(
      "https://online.phuquocexpress.com/Booking/SearchVoyage",
      {RouteId:routeId,DepartDate:day,NoOfPassenger:1},
      {timeoutMs:9000}
    );
    for(const x of Array.isArray(data)?data:[]){
      const depart=isoLocal(day,x?.DepartTime);
      if(!depart)continue;
      const vessel=String(x?.BoatNm||"Phú Quốc Express");
      const remaining=num(x?.NoOfRemain);
      const capInfo=capacityForPqe(vessel);
      const capacity=num(capInfo.capacity);
      const load=capacity!=null&&capacity>0&&remaining!=null
        ?Math.max(0,Math.min(100,((capacity-remaining)/capacity)*100))
        :null;
      rows.push({
        observed_at:isoNow(),service_date:day,operator:"Phú Quốc Express",
        origin:pair[0],destination:pair[1],departure_time:depart,vessel,
        capacity,remaining,load_factor:load,load_basis:capInfo.basis,
        evidence_class:load==null?"observed_remaining":"estimated"
      });
    }
  }
  return rows;
}
async function collectSuperdongLoad(day){
  const landing=await fetch("https://online.superdong.com.vn/Booking",{
    headers:{"user-agent":"Mozilla/5.0","referer":"https://www.superdong.com.vn/"},
    cache:"no-store"
  });
  if(!landing.ok)throw new Error("Superdong landing HTTP "+landing.status);
  const setCookie=landing.headers.get("set-cookie")||"";
  const cookie=setCookie.split(";")[0];
  const rows=[];
  for(const [routeId,pair] of Object.entries(SUPERDONG_ROUTES)){
    const {data}=await fetchJsonDetailed(
      "https://online.superdong.com.vn/api/Boat/getBoat",
      {RouteId:routeId,DepartDate:day,NoOfPassenger:1},
      {
        timeoutMs:9000,
        accept:"application/json,text/javascript,*/*;q=0.01",
        headers:{
          "x-requested-with":"XMLHttpRequest",
          "referer":"https://online.superdong.com.vn/Booking",
          ...(cookie?{"cookie":cookie}:{})
        }
      }
    );
    for(const x of Array.isArray(data)?data:[]){
      const depart=isoLocal(day,x?.DepartTime);
      if(!depart)continue;
      const capacity=num(x?.NoOfSeat);
      const remaining=num(x?.NoOfRemain);
      const load=capacity!=null&&capacity>0&&remaining!=null
        ?Math.max(0,Math.min(100,((capacity-remaining)/capacity)*100))
        :null;
      rows.push({
        observed_at:isoNow(),service_date:day,operator:"Superdong",
        origin:pair[0],destination:pair[1],departure_time:depart,
        vessel:String(x?.BoatNm||"Superdong"),
        capacity,remaining,load_factor:load,load_basis:"booking_capacity_remaining",
        evidence_class:load==null?"observed":"observed"
      });
    }
  }
  return rows;
}
async function syncSeaLoad(db,day,force=false){
  const source="sea_load";
  const prev=await lastSync(db,source);
  if(!force&&isFresh(prev,5))return {source,status:"cached",records:prev.records||0,last_success_at:prev.last_success_at};
  let rows=[],errors=[];
  const [pqe,sd]=await Promise.allSettled([collectPqeLoad(day),collectSuperdongLoad(day)]);
  if(pqe.status==="fulfilled")rows.push(...pqe.value);else errors.push("PQE: "+(pqe.reason?.message||pqe.reason));
  if(sd.status==="fulfilled")rows.push(...sd.value);else errors.push("Superdong: "+(sd.reason?.message||sd.reason));
  if(db&&rows.length){
    const stmts=rows.map(r=>db.prepare(`
      INSERT OR IGNORE INTO sea_load_observations(
        observed_at,service_date,operator,origin,destination,departure_time,vessel,
        capacity,remaining,load_factor,load_basis,evidence_class
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      r.observed_at,r.service_date,r.operator,r.origin,r.destination,r.departure_time,r.vessel,
      r.capacity,r.remaining,r.load_factor,r.load_basis,r.evidence_class
    ));
    await db.batch(stmts);
  }
  const status=rows.length?"ok":"error";
  await markSync(db,source,status,rows.length,errors.join(" | "));
  return {source,status,records:rows.length,rows,errors};
}


function transitRow(r,observedAt){
  const fare=r?.fare||{};
  const capacity=num(r?.capacity_proxy??r?.capacity??r?.NoOfSeat);
  const remaining=num(r?.remaining_proxy??r?.remaining??r?.NoOfRemain);
  let load=num(r?.load_factor_proxy);
  if(load==null&&capacity!=null&&capacity>0&&remaining!=null)load=Math.max(0,Math.min(100,((capacity-remaining)/capacity)*100));
  return {
    observed_at:observedAt,
    service_date:datePart(r?.departure_time)||datePart(r?.service_date),
    operator:String(r?.operator||"").trim(),
    mode:String(r?.mode||r?.type||"").trim(),
    origin:String(r?.origin||"").trim(),
    destination:String(r?.destination||"").trim(),
    departure_time:r?.departure_time||null,
    arrival_time:r?.arrival_time||null,
    adult_fare:num(fare?.adult??r?.adult_fare),
    currency:String(fare?.currency||r?.currency||"VND"),
    capacity_proxy:capacity,
    remaining_proxy:remaining,
    load_factor_proxy:load,
    evidence_class:load!=null?"proxy":"observed"
  };
}

async function syncTransit(db,force=false){
  const source="transit";
  const prev=await lastSync(db,source);
  if(!force&&isFresh(prev,5))return {source,status:"cached",records:prev.records||0,last_success_at:prev.last_success_at};
  try{
    const payload=await fetchJson("https://raw.githubusercontent.com/kenzuko/transit-jotrip/main/data/network.json?t="+Date.now(),8500);
    const observedAt=payload?.generated_at||isoNow();
    const rows=(payload?.departures||[]).map(r=>transitRow(r,observedAt)).filter(r=>r.operator&&r.departure_time);
    if(db&&rows.length){
      const stmts=rows.map(r=>db.prepare(`
        INSERT OR IGNORE INTO transit_observations(
          observed_at,service_date,operator,mode,origin,destination,departure_time,arrival_time,
          adult_fare,currency,capacity_proxy,remaining_proxy,load_factor_proxy,evidence_class
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).bind(
        r.observed_at,r.service_date,r.operator,r.mode,r.origin,r.destination,r.departure_time,r.arrival_time,
        r.adult_fare,r.currency,r.capacity_proxy,r.remaining_proxy,r.load_factor_proxy,r.evidence_class
      ));
      await db.batch(stmts);
    }
    await markSync(db,source,"ok",rows.length,"");
    return {source,status:"ok",records:rows.length,observed_at:observedAt,rows};
  }catch(e){
    await markSync(db,source,"error",0,e?.message||String(e));
    return {source,status:"error",records:0,error:e?.message||String(e)};
  }
}

function aviationRow(r,observedAt,sourceDate){
  const flight=String(r?.operating_flight_number||r?.flight_number||"").trim();
  const direction=String(r?.direction||"").trim();
  const station=String(r?.station||r?.station_name||r?.origin||r?.destination||r?.route||"").trim();
  return {
    observed_at:observedAt,
    service_date:sourceDate||datePart(r?.service_date)||datePart(observedAt),
    direction,
    flight_number:flight,
    airline:String(r?.airline_name||r?.airline_code||"").trim(),
    station,
    scheduled_time:r?.scheduled_time||r?.times?.[0]||null,
    status:String(r?.status_code||r?.status||r?.raw_status||"").trim(),
    delay_minutes:num(r?.delay_minutes),
    capacity_proxy:num(r?.capacity_proxy),
    load_factor_proxy:num(r?.load_factor_proxy),
    evidence_class:num(r?.load_factor_proxy)!=null?"proxy":"observed"
  };
}

async function syncAviation(db,force=false){
  const source="aviation";
  const prev=await lastSync(db,source);
  if(!force&&isFresh(prev,5))return {source,status:"cached",records:prev.records||0,last_success_at:prev.last_success_at};
  try{
    const body=await fetchJson("https://jotrip-airport-live.kenzuko.workers.dev?t="+Date.now(),6500);
    const latest=body?.latest||body||{};
    const observedAt=latest?.collected_at_vn||latest?.collected_at||isoNow();
    const sourceDate=latest?.source_date||datePart(observedAt);
    const rows=(latest?.records||[]).map(r=>aviationRow(r,observedAt,sourceDate)).filter(r=>r.flight_number);
    if(db&&rows.length){
      const stmts=rows.map(r=>db.prepare(`
        INSERT OR IGNORE INTO aviation_observations(
          observed_at,service_date,direction,flight_number,airline,station,scheduled_time,status,
          delay_minutes,capacity_proxy,load_factor_proxy,evidence_class
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
      `).bind(
        r.observed_at,r.service_date,r.direction,r.flight_number,r.airline,r.station,r.scheduled_time,r.status,
        r.delay_minutes,r.capacity_proxy,r.load_factor_proxy,r.evidence_class
      ));
      await db.batch(stmts);
    }
    await markSync(db,source,"ok",rows.length,"");
    return {source,status:"ok",records:rows.length,observed_at:observedAt,rows};
  }catch(e){
    await markSync(db,source,"error",0,e?.message||String(e));
    return {source,status:"error",records:0,error:e?.message||String(e)};
  }
}

function isInboundSea(r){return /phú quốc/i.test(String(r.destination||""))}
function isOutboundSea(r){return /phú quốc/i.test(String(r.origin||""))}

function currentSeaSummary(rows=[]){
  const inbound=rows.filter(isInboundSea);
  const outbound=rows.filter(isOutboundSea);
  const operators=[...new Set(rows.map(r=>r.operator).filter(Boolean))];
  const loadRows=rows.filter(r=>num(r.load_factor_proxy)!=null);
  const avgLoad=loadRows.length?loadRows.reduce((s,r)=>s+Number(r.load_factor_proxy),0)/loadRows.length:null;
  return {
    departures:rows.length,
    inbound_departures:inbound.length,
    outbound_departures:outbound.length,
    operators:operators.length,
    operator_names:operators,
    avg_load_factor_proxy:avgLoad,
    load_factor_coverage:rows.length?loadRows.length/rows.length*100:0
  };
}

function currentAviationSummary(rows=[]){
  const arrivals=rows.filter(r=>String(r.direction).toLowerCase()==="arrival");
  const departures=rows.filter(r=>String(r.direction).toLowerCase()==="departure");
  const delayed=rows.filter(r=>/DELAY|RESCHEDULE|POSTPON|TRỄ|CHẬM|HOÃN/i.test(r.status||""));
  const cancelled=rows.filter(r=>/CANCEL|HỦY/i.test(r.status||""));
  const loadRows=rows.filter(r=>num(r.load_factor_proxy)!=null);
  const avgLoad=loadRows.length?loadRows.reduce((s,r)=>s+Number(r.load_factor_proxy),0)/loadRows.length:null;
  return {
    flights:rows.length,
    arrivals:arrivals.length,
    departures:departures.length,
    delayed:delayed.length,
    cancelled:cancelled.length,
    avg_load_factor_proxy:avgLoad,
    load_factor_coverage:rows.length?loadRows.length/rows.length*100:0
  };
}

async function dashboardFromDb(db,transitSync,aviationSync,seaLoadSync,fromDay,toDay){
  let seaRows=transitSync.rows||[];
  let airRows=aviationSync.rows||[];
  let trends=[],sync=[],routeLoads=[],operatorLoads=[],tripLoads=[],comparison={},seaRoutes=[],airlines=[],stations=[],airStatus={},loadTrends=[];

  if(db){
    if(!seaRows.length){
      const latest=await db.prepare("SELECT MAX(observed_at) at FROM transit_observations").first();
      if(latest?.at)seaRows=(await db.prepare("SELECT * FROM transit_observations WHERE observed_at=? ORDER BY departure_time").bind(latest.at).all()).results||[];
    }
    if(!airRows.length){
      const latest=await db.prepare("SELECT MAX(observed_at) at FROM aviation_observations").first();
      if(latest?.at)airRows=(await db.prepare("SELECT * FROM aviation_observations WHERE observed_at=? ORDER BY scheduled_time").bind(latest.at).all()).results||[];
    }

    trends=(await db.prepare(`
      WITH sea AS (
        SELECT service_date day,
          COUNT(DISTINCT CASE WHEN destination LIKE '%Phú Quốc%' THEN operator||'|'||departure_time END) sea_in,
          COUNT(DISTINCT CASE WHEN origin LIKE '%Phú Quốc%' THEN operator||'|'||departure_time END) sea_out
        FROM transit_observations
        WHERE service_date BETWEEN ? AND ?
        GROUP BY service_date
      ),
      air AS (
        SELECT service_date day,
          COUNT(DISTINCT CASE WHEN lower(direction)='arrival' THEN flight_number||'|'||scheduled_time END) air_in,
          COUNT(DISTINCT CASE WHEN lower(direction)='departure' THEN flight_number||'|'||scheduled_time END) air_out
        FROM aviation_observations
        WHERE service_date BETWEEN ? AND ?
        GROUP BY service_date
      ),
      days AS (
        SELECT day FROM sea UNION SELECT day FROM air
      )
      SELECT days.day,
        COALESCE(sea.sea_in,0) sea_in,COALESCE(sea.sea_out,0) sea_out,
        COALESCE(air.air_in,0) air_in,COALESCE(air.air_out,0) air_out
      FROM days LEFT JOIN sea ON sea.day=days.day LEFT JOIN air ON air.day=days.day
      ORDER BY days.day
    `).bind(fromDay,toDay,fromDay,toDay).all()).results||[];

    routeLoads=(await db.prepare(`
      WITH ranked AS (
        SELECT *,
          ROW_NUMBER() OVER (
            PARTITION BY service_date,operator,origin,destination,departure_time
            ORDER BY observed_at DESC
          ) rn
        FROM sea_load_observations
        WHERE service_date BETWEEN ? AND ?
      )
      SELECT operator,origin,destination,
        COUNT(*) trips,
        SUM(CASE WHEN load_factor IS NOT NULL THEN 1 ELSE 0 END) load_trips,
        ROUND(
          100.0*SUM(CASE WHEN capacity>0 AND remaining IS NOT NULL THEN capacity-remaining ELSE 0 END)/
          NULLIF(SUM(CASE WHEN capacity>0 AND remaining IS NOT NULL THEN capacity ELSE 0 END),0),1
        ) load_factor,
        SUM(CASE WHEN capacity>0 AND remaining IS NOT NULL THEN capacity ELSE 0 END) capacity_observed,
        SUM(CASE WHEN capacity>0 AND remaining IS NOT NULL THEN capacity-remaining ELSE 0 END) sold_proxy
      FROM ranked WHERE rn=1
      GROUP BY operator,origin,destination
      ORDER BY load_factor DESC, trips DESC
    `).bind(fromDay,toDay).all()).results||[];

    operatorLoads=(await db.prepare(`
      WITH ranked AS (
        SELECT *,
          ROW_NUMBER() OVER (
            PARTITION BY service_date,operator,origin,destination,departure_time
            ORDER BY observed_at DESC
          ) rn
        FROM sea_load_observations
        WHERE service_date BETWEEN ? AND ?
      )
      SELECT operator,
        COUNT(*) trips,
        SUM(CASE WHEN load_factor IS NOT NULL THEN 1 ELSE 0 END) load_trips,
        ROUND(
          100.0*SUM(CASE WHEN capacity>0 AND remaining IS NOT NULL THEN capacity-remaining ELSE 0 END)/
          NULLIF(SUM(CASE WHEN capacity>0 AND remaining IS NOT NULL THEN capacity ELSE 0 END),0),1
        ) load_factor
      FROM ranked WHERE rn=1
      GROUP BY operator
      ORDER BY load_factor DESC
    `).bind(fromDay,toDay).all()).results||[];

    tripLoads=(await db.prepare(`
      WITH ranked AS (
        SELECT *,
          ROW_NUMBER() OVER (
            PARTITION BY service_date,operator,origin,destination,departure_time
            ORDER BY observed_at DESC
          ) rn
        FROM sea_load_observations
        WHERE service_date BETWEEN ? AND ?
      )
      SELECT service_date,operator,origin,destination,departure_time,vessel,
        capacity,remaining,ROUND(load_factor,1) load_factor,load_basis,evidence_class
      FROM ranked WHERE rn=1
      ORDER BY service_date DESC,departure_time
      LIMIT 300
    `).bind(fromDay,toDay).all()).results||[];

    seaRoutes=(await db.prepare(`
      SELECT operator,origin,destination,
        COUNT(DISTINCT service_date||'|'||departure_time) trips
      FROM transit_observations
      WHERE service_date BETWEEN ? AND ?
      GROUP BY operator,origin,destination
      ORDER BY trips DESC,operator,origin,destination
      LIMIT 40
    `).bind(fromDay,toDay).all()).results||[];

    airlines=(await db.prepare(`
      WITH ranked AS (
        SELECT *,
          ROW_NUMBER() OVER (
            PARTITION BY service_date,direction,flight_number,scheduled_time
            ORDER BY observed_at DESC
          ) rn
        FROM aviation_observations
        WHERE service_date BETWEEN ? AND ?
      )
      SELECT airline,COUNT(*) flights,
        SUM(CASE WHEN lower(direction)='arrival' THEN 1 ELSE 0 END) arrivals,
        SUM(CASE WHEN lower(direction)='departure' THEN 1 ELSE 0 END) departures
      FROM ranked WHERE rn=1
      GROUP BY airline
      ORDER BY flights DESC,airline
      LIMIT 30
    `).bind(fromDay,toDay).all()).results||[];

    stations=(await db.prepare(`
      WITH ranked AS (
        SELECT *,
          ROW_NUMBER() OVER (
            PARTITION BY service_date,direction,flight_number,scheduled_time
            ORDER BY observed_at DESC
          ) rn
        FROM aviation_observations
        WHERE service_date BETWEEN ? AND ?
      )
      SELECT station,COUNT(*) flights,
        SUM(CASE WHEN lower(direction)='arrival' THEN 1 ELSE 0 END) arrivals,
        SUM(CASE WHEN lower(direction)='departure' THEN 1 ELSE 0 END) departures
      FROM ranked WHERE rn=1
      GROUP BY station
      ORDER BY flights DESC,station
      LIMIT 30
    `).bind(fromDay,toDay).all()).results||[];

    airStatus=(await db.prepare(`
      WITH ranked AS (
        SELECT *,
          ROW_NUMBER() OVER (
            PARTITION BY service_date,direction,flight_number,scheduled_time
            ORDER BY observed_at DESC
          ) rn
        FROM aviation_observations
        WHERE service_date BETWEEN ? AND ?
      )
      SELECT
        COUNT(*) flights,
        SUM(CASE WHEN status LIKE '%DELAY%' OR status LIKE '%TRỄ%' OR status LIKE '%CHẬM%' OR status LIKE '%HOÃN%' THEN 1 ELSE 0 END) delayed,
        SUM(CASE WHEN status LIKE '%CANCEL%' OR status LIKE '%HỦY%' THEN 1 ELSE 0 END) cancelled,
        ROUND(AVG(CASE WHEN delay_minutes>0 THEN delay_minutes END),1) avg_delay_minutes
      FROM ranked WHERE rn=1
    `).bind(fromDay,toDay).first())||{};

    loadTrends=(await db.prepare(`
      WITH ranked AS (
        SELECT *,
          ROW_NUMBER() OVER (
            PARTITION BY service_date,operator,origin,destination,departure_time
            ORDER BY observed_at DESC
          ) rn
        FROM sea_load_observations
        WHERE service_date BETWEEN ? AND ?
      )
      SELECT service_date day,
        ROUND(
          100.0*SUM(CASE WHEN capacity>0 AND remaining IS NOT NULL THEN capacity-remaining ELSE 0 END)/
          NULLIF(SUM(CASE WHEN capacity>0 AND remaining IS NOT NULL THEN capacity ELSE 0 END),0),1
        ) load_factor,
        COUNT(*) trips,
        SUM(CASE WHEN load_factor IS NOT NULL THEN 1 ELSE 0 END) load_trips
      FROM ranked WHERE rn=1
      GROUP BY service_date
      ORDER BY service_date
    `).bind(fromDay,toDay).all()).results||[];


    const span=diffDays(fromDay,toDay)+1;
    const prevTo=addDays(fromDay,-1);
    const prevFrom=addDays(prevTo,-span+1);
    const totals=await db.prepare(`
      WITH sea AS (
        SELECT
          COUNT(DISTINCT CASE WHEN service_date BETWEEN ? AND ? AND destination LIKE '%Phú Quốc%' THEN service_date||'|'||operator||'|'||departure_time END) cur_sea_in,
          COUNT(DISTINCT CASE WHEN service_date BETWEEN ? AND ? AND origin LIKE '%Phú Quốc%' THEN service_date||'|'||operator||'|'||departure_time END) cur_sea_out,
          COUNT(DISTINCT CASE WHEN service_date BETWEEN ? AND ? AND destination LIKE '%Phú Quốc%' THEN service_date||'|'||operator||'|'||departure_time END) prev_sea_in,
          COUNT(DISTINCT CASE WHEN service_date BETWEEN ? AND ? AND origin LIKE '%Phú Quốc%' THEN service_date||'|'||operator||'|'||departure_time END) prev_sea_out
        FROM transit_observations
      ),
      air AS (
        SELECT
          COUNT(DISTINCT CASE WHEN service_date BETWEEN ? AND ? AND lower(direction)='arrival' THEN service_date||'|'||flight_number||'|'||scheduled_time END) cur_air_in,
          COUNT(DISTINCT CASE WHEN service_date BETWEEN ? AND ? AND lower(direction)='departure' THEN service_date||'|'||flight_number||'|'||scheduled_time END) cur_air_out,
          COUNT(DISTINCT CASE WHEN service_date BETWEEN ? AND ? AND lower(direction)='arrival' THEN service_date||'|'||flight_number||'|'||scheduled_time END) prev_air_in,
          COUNT(DISTINCT CASE WHEN service_date BETWEEN ? AND ? AND lower(direction)='departure' THEN service_date||'|'||flight_number||'|'||scheduled_time END) prev_air_out
        FROM aviation_observations
      )
      SELECT * FROM sea CROSS JOIN air
    `).bind(
      fromDay,toDay,fromDay,toDay,prevFrom,prevTo,prevFrom,prevTo,
      fromDay,toDay,fromDay,toDay,prevFrom,prevTo,prevFrom,prevTo
    ).first();
    comparison={...(totals||{}),previous_from:prevFrom,previous_to:prevTo};

    sync=(await db.prepare("SELECT source,last_attempt_at,last_success_at,status,records,message FROM analytics_sync ORDER BY source").all()).results||[];
  }

  const loadByTrip=new Map(tripLoads.map(r=>[
    [r.operator,r.origin,r.destination,r.departure_time].join("|"),r
  ]));
  seaRows=seaRows.map(r=>{
    const hit=loadByTrip.get([r.operator,r.origin,r.destination,r.departure_time].join("|"));
    return hit?{...r,load_factor_proxy:hit.load_factor,load_basis:hit.load_basis,evidence_class:hit.evidence_class}:r;
  });

  return {
    generated_at:isoNow(),
    period:{from:fromDay,to:toDay,days:diffDays(fromDay,toDay)+1},
    storage:{d1:Boolean(db),binding:db?"connected":"missing"},
    evidence_note:"% phủ biển là load proxy từ sức chứa và chỗ còn lại công khai hoặc capacity tàu công khai. Đây không phải số hành khách thực tế. Không lưu tên khách, điện thoại, email, biển số, mã đặt chỗ hay thanh toán.",
    sea:{
      summary:currentSeaSummary(seaRows),
      rows:seaRows.slice(0,160),
      route_loads:routeLoads,
      operator_loads:operatorLoads,
      trip_loads:tripLoads,
      route_volume:seaRoutes,
      load_trends:loadTrends
    },
    aviation:{
      summary:currentAviationSummary(airRows),
      rows:airRows.slice(0,180),
      airlines,
      stations,
      status_summary:airStatus
    },
    trends,
    comparison,
    sync
  };
}

export async function onRequest({request,env}){
  try{
    const s=await session(request,String(env.CMS_SESSION_SECRET||""));
    if(!s)return json({error:"Chưa đăng nhập"},401);
    if(await currentRole(s.login)!=="admin")return json({error:"Analytics chỉ dành cho quản trị viên"},403);
    if(request.method!=="GET")return json({error:"Method không hỗ trợ"},405);

    const db=dbFromEnv(env);
    if(db)await ensureSchema(db);

    const url=new URL(request.url);
    const force=url.searchParams.get("refresh")==="1";
    const today=localDay();
    let toDay=dateOnlyValid(url.searchParams.get("to"))?url.searchParams.get("to"):today;
    let fromDay=dateOnlyValid(url.searchParams.get("from"))?url.searchParams.get("from"):addDays(toDay,-6);
    if(fromDay>toDay)[fromDay,toDay]=[toDay,fromDay];
    if(diffDays(fromDay,toDay)>89)fromDay=addDays(toDay,-89);

    const [transitSync,aviationSync,seaLoadSync]=await Promise.all([
      syncTransit(db,force),
      syncAviation(db,force),
      syncSeaLoad(db,today,force)
    ]);
    const dashboard=await dashboardFromDb(db,transitSync,aviationSync,seaLoadSync,fromDay,toDay);
    dashboard.sources={transit:transitSync,aviation:aviationSync,sea_load:seaLoadSync};
    return json(dashboard);
  }catch(e){
    return json({error:e?.message||String(e)},500);
  }
}
