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

async function dashboardFromDb(db,transitSync,aviationSync){
  let seaRows=transitSync.rows||[];
  let airRows=aviationSync.rows||[];
  let trends=[];
  let sync=[];
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
        WHERE service_date IS NOT NULL
        GROUP BY service_date
      ),
      air AS (
        SELECT service_date day,
          COUNT(DISTINCT CASE WHEN lower(direction)='arrival' THEN flight_number||'|'||scheduled_time END) air_in,
          COUNT(DISTINCT CASE WHEN lower(direction)='departure' THEN flight_number||'|'||scheduled_time END) air_out
        FROM aviation_observations
        WHERE service_date IS NOT NULL
        GROUP BY service_date
      )
      SELECT COALESCE(sea.day,air.day) day,
        COALESCE(sea.sea_in,0) sea_in,COALESCE(sea.sea_out,0) sea_out,
        COALESCE(air.air_in,0) air_in,COALESCE(air.air_out,0) air_out
      FROM sea LEFT JOIN air ON sea.day=air.day
      UNION
      SELECT COALESCE(sea.day,air.day) day,
        COALESCE(sea.sea_in,0),COALESCE(sea.sea_out,0),
        COALESCE(air.air_in,0),COALESCE(air.air_out,0)
      FROM air LEFT JOIN sea ON sea.day=air.day
      ORDER BY day DESC LIMIT 30
    `).all()).results||[];
    sync=(await db.prepare("SELECT source,last_attempt_at,last_success_at,status,records,message FROM analytics_sync ORDER BY source").all()).results||[];
  }
  return {
    generated_at:isoNow(),
    storage:{d1:Boolean(db),binding:db?"connected":"missing"},
    evidence_note:"Load factor chỉ được hiển thị khi có capacity/remaining hoặc proxy hợp lệ. Không lưu tên khách, điện thoại, email, biển số, mã đặt chỗ hay dữ liệu thanh toán.",
    sea:{summary:currentSeaSummary(seaRows),rows:seaRows.slice(0,120)},
    aviation:{summary:currentAviationSummary(airRows),rows:airRows.slice(0,160)},
    trends:[...trends].reverse(),
    sync
  };
}

export async function onRequest({request,env}){
  try{
    const s=await session(request,String(env.CMS_SESSION_SECRET||""));
    if(!s)return json({error:"Chưa đăng nhập"},401);
    if(s.role!=="admin")return json({error:"Analytics chỉ dành cho quản trị viên"},403);
    if(request.method!=="GET")return json({error:"Method không hỗ trợ"},405);

    const db=dbFromEnv(env);
    if(db)await ensureSchema(db);

    const url=new URL(request.url);
    const force=url.searchParams.get("refresh")==="1";
    const [transitSync,aviationSync]=await Promise.all([
      syncTransit(db,force),
      syncAviation(db,force)
    ]);
    const dashboard=await dashboardFromDb(db,transitSync,aviationSync);
    dashboard.sources={transit:transitSync,aviation:aviationSync};
    return json(dashboard);
  }catch(e){
    return json({error:e?.message||String(e)},500);
  }
}
