const VCB_XML = 'https://portal.vietcombank.com.vn/Usercontrols/TVPortal.TyGia/pXML.aspx';
const SOURCE_URL = 'https://www.vietcombank.com.vn/vi-VN/KHCN/Cong-cu-Tien-ich/Ty-gia';
const CACHE_URL = 'https://openpq.internal/currency/current';
const RANGE_MS = { '7d':7*86400000, '30d':30*86400000, '90d':90*86400000, '1y':365*86400000 };

function json(data,status=200,extra={}){
  return new Response(JSON.stringify(data),{
    status,
    headers:{
      'content-type':'application/json; charset=utf-8',
      'access-control-allow-origin':'*',
      'cache-control':'no-store',
      ...extra
    }
  });
}
function decodeXml(value=''){
  return value.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');
}
function numeric(value){
  if(value==null) return null;
  const clean=String(value).trim().replace(/,/g,'');
  if(!clean || clean==='-' || clean==='0') return clean==='0'?0:null;
  const n=Number(clean);
  return Number.isFinite(n)?n:null;
}
function attr(tag,name){
  const match=tag.match(new RegExp(name+"\\s*=\\s*[\"']([^\"']*)[\"']","i"));
  return match?decodeXml(match[1]):null;
}
function vcbTimeToIso(raw){
  if(!raw) return null;
  const text=String(raw).trim();
  let m=text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if(!m) m=text.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if(!m) return null;
  if(text.indexOf('/') < text.indexOf(':')){
    const [,d,mo,y,h,mi,s='00']=m;
    return y+'-'+mo.padStart(2,'0')+'-'+d.padStart(2,'0')+'T'+h.padStart(2,'0')+':'+mi+':'+s+'+07:00';
  }
  const [,h,mi,s='00',d,mo,y]=m;
  return y+'-'+mo.padStart(2,'0')+'-'+d.padStart(2,'0')+'T'+h.padStart(2,'0')+':'+mi+':'+s+'+07:00';
}
function parseVcbXml(xml){
  const timeMatch=xml.match(/<DateTime>([\s\S]*?)<\/DateTime>/i);
  const sourceUpdatedAt=vcbTimeToIso(timeMatch?decodeXml(timeMatch[1]):null);
  const tags=xml.match(/<Exrate\b[^>]*\/?\s*>/gi)||[];
  const rates=tags.map(tag=>({
    currency:String(attr(tag,'CurrencyCode')||'').toUpperCase(),
    name:attr(tag,'CurrencyName')||'',
    cash_buy:numeric(attr(tag,'Buy')),
    transfer_buy:numeric(attr(tag,'Transfer')),
    sell:numeric(attr(tag,'Sell'))
  })).filter(row=>row.currency);
  if(!rates.length) throw new Error('VCB_XML_EMPTY');
  return {
    schema_version:'1.0',
    source:{id:'vietcombank',name:'Vietcombank',official_url:SOURCE_URL,xml_url:VCB_XML},
    data_status:'live',
    source_updated_at:sourceUpdatedAt,
    fetched_at:new Date().toISOString(),
    rates
  };
}
async function fetchVcb(){
  const response=await fetch(VCB_XML,{
    headers:{'accept':'application/xml,text/xml;q=0.9,*/*;q=0.8','user-agent':'OpenPhuQuoc-Currency/1.0'},
    cf:{cacheEverything:true,cacheTtl:300}
  });
  if(!response.ok) throw new Error('VCB_HTTP_'+response.status);
  return parseVcbXml(await response.text());
}
async function persist(env,payload){
  if(!env.CURRENCY_DB || !payload?.rates?.length) return;
  const sourceAt=payload.source_updated_at||payload.fetched_at;
  const statements=payload.rates.map(row=>env.CURRENCY_DB.prepare(
    'INSERT OR IGNORE INTO currency_snapshots (source_updated_at,fetched_at,currency,name,cash_buy,transfer_buy,sell) VALUES (?,?,?,?,?,?,?)'
  ).bind(sourceAt,payload.fetched_at,row.currency,row.name,row.cash_buy,row.transfer_buy,row.sell));
  await env.CURRENCY_DB.batch(statements);
}
async function latestFromDb(env){
  if(!env.CURRENCY_DB) return null;
  const result=await env.CURRENCY_DB.prepare(
    'SELECT source_updated_at,fetched_at,currency,name,cash_buy,transfer_buy,sell FROM currency_snapshots WHERE source_updated_at=(SELECT MAX(source_updated_at) FROM currency_snapshots) ORDER BY currency'
  ).all();
  const rows=result.results||[];
  if(!rows.length) return null;
  return {
    schema_version:'1.0',
    source:{id:'vietcombank',name:'Vietcombank',official_url:SOURCE_URL},
    data_status:'cached',
    source_updated_at:rows[0].source_updated_at,
    fetched_at:rows[0].fetched_at,
    rates:rows.map(row=>({
      currency:row.currency,name:row.name,cash_buy:row.cash_buy,transfer_buy:row.transfer_buy,sell:row.sell
    })),
    message:'Nguồn Vietcombank tạm không phản hồi. Đang dùng bản gần nhất đã lưu.'
  };
}
async function current(env,ctx){
  const cache=globalThis.caches?.default;
  const key=new Request(CACHE_URL);
  if(cache){
    const hit=await cache.match(key);
    if(hit) return hit;
  }
  let payload;
  try{
    payload=await fetchVcb();
    if(ctx) ctx.waitUntil(persist(env,payload));
  }catch(error){
    console.error('[currency] live fetch failed',error);
    payload=await latestFromDb(env);
    if(!payload) return json({schema_version:'1.0',source:'vietcombank',data_status:'unavailable',rates:[],message:'Không lấy được dữ liệu Vietcombank và chưa có bản lưu dự phòng.'},503);
  }
  const response=json(payload,200,{'cache-control':'public, max-age=60, s-maxage=300'});
  if(cache && payload.data_status==='live') ctx?.waitUntil(cache.put(key,response.clone()));
  return response;
}
function parseCurrencies(value){
  const allowed=new Set(['USD','EUR','GBP','JPY','AUD','SGD','THB','CAD','CHF','HKD','CNY','DKK','INR','KRW','KWD','MYR','NOK','RUB','SAR','SEK']);
  const codes=String(value||'USD').toUpperCase().split(',').map(x=>x.trim()).filter(x=>allowed.has(x));
  return [...new Set(codes)].slice(0,8);
}
async function history(request,env){
  if(!env.CURRENCY_DB) return json({schema_version:'1.0',points:[],message:'History storage is not configured.'},503);
  const url=new URL(request.url);
  const range=RANGE_MS[url.searchParams.get('range')]?url.searchParams.get('range'):'30d';
  const currencies=parseCurrencies(url.searchParams.get('currencies'));
  const cutoff=new Date(Date.now()-RANGE_MS[range]).toISOString();
  const marks=currencies.map(()=>'?').join(',');
  const result=await env.CURRENCY_DB.prepare(
    'SELECT source_updated_at AS at,currency,cash_buy,transfer_buy,sell FROM currency_snapshots WHERE currency IN ('+marks+') AND fetched_at>=? ORDER BY fetched_at ASC LIMIT 8000'
  ).bind(...currencies,cutoff).all();
  return json({schema_version:'1.0',source:'vietcombank',range,currencies,points:result.results||[]},200,{'cache-control':'public, max-age=300'});
}
async function health(env){
  const latest=await latestFromDb(env);
  return json({ok:!!latest,source:'vietcombank',latest_source_updated_at:latest?.source_updated_at||null,stored_currencies:latest?.rates?.length||0});
}

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(request.method==='OPTIONS') return new Response(null,{status:204,headers:{'access-control-allow-origin':'*','access-control-allow-methods':'GET,OPTIONS','access-control-allow-headers':'content-type'}});
    if(request.method!=='GET') return json({error:'METHOD_NOT_ALLOWED'},405);
    if(url.pathname==='/api/exchange-rates' || url.pathname==='/') return current(env,ctx);
    if(url.pathname==='/api/exchange-rates/history') return history(request,env);
    if(url.pathname==='/api/exchange-rates/health') return health(env);
    return json({error:'NOT_FOUND'},404);
  },
  async scheduled(event,env,ctx){
    ctx.waitUntil((async()=>{
      const payload=await fetchVcb();
      await persist(env,payload);
      if(globalThis.caches?.default){
        const key=new Request(CACHE_URL);
        await caches.default.put(key,json(payload,200,{'cache-control':'public, max-age=60, s-maxage=300'}));
      }
    })());
  }
};
