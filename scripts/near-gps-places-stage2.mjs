/**
 * Near Me GPS follow-up: Geoapify named Places, by operator + region.
 * Data-only research: never writes canonical entities or marks business OPEN.
 * Run: GEOAPIFY_API_KEY=... node scripts/near-gps-places-stage2.mjs --budget=7
 * Test: node scripts/near-gps-places-stage2.mjs --self-test
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

export const GROUPS = [
  { key:'dng-south', ids:['utility_dng_clinic_an_thoi'], name:'DNG', category:'healthcare.clinic_or_praxis', rect:[103.93,9.85,104.12,10.14], zone:'An Thới' },
  { key:'dng-central', ids:['utility_dng_clinic_duong_dong'], name:'DNG', category:'healthcare.clinic_or_praxis', rect:[103.82,10.12,104.08,10.30], zone:'Dương Đông' },
  { key:'longchau-north', ids:['utility_longchau_ganh_dau'], name:'Long Châu', category:'healthcare.pharmacy', rect:[103.78,10.28,103.97,10.48], zone:'Gành Dầu' },
  { key:'longchau-east', ids:['utility_longchau_ham_ninh'], name:'Long Châu', category:'healthcare.pharmacy', rect:[104.00,10.08,104.14,10.26], zone:'Hàm Ninh' },
  { key:'longchau-suoida', ids:['utility_longchau_suoi_da'], name:'Long Châu', category:'healthcare.pharmacy', rect:[103.90,10.09,104.08,10.27], zone:'Suối Đá / Dương Tơ' },
  { key:'longchau-central', ids:['utility_longchau_dt45','utility_longchau_ben_tram'], name:'Long Châu', category:'healthcare.pharmacy', rect:[103.88,10.14,104.05,10.30], zone:'Dương Đông / Bến Tràm' },
  { key:'fuel-central', ids:['utility_fuel_dong_loi_1'], name:'Đông Lợi', category:'service.vehicle.fuel', rect:[103.88,10.12,104.05,10.30], zone:'Nguyễn Trung Trực' }
];

export function fold(s='') {
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/đ/g,'d').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
}
export function matchBrand(g,poiName='') {
  const got=fold(poiName);
  if(!got) return false;
  if(g.name==='DNG') return /\bdng\b/.test(got);
  if(g.name==='Long Châu') return got.includes('long chau');
  if(g.name==='Đông Lợi') return got.includes('dong loi');
  return false;
}
export function within(lat,lon,rect) {
  return Number.isFinite(lat)&&Number.isFinite(lon)&&
    lon>=rect[0]&&lat>=rect[1]&&lon<=rect[2]&&lat<=rect[3];
}
export function extractPlace(feature) {
  const p=feature?.properties||{};
  const c=feature?.geometry?.coordinates||[];
  const lat=Number(p.lat??c[1]),lon=Number(p.lon??c[0]);
  if(!Number.isFinite(lat)||!Number.isFinite(lon)) return null;
  return {
    name:p.name||p.address_line1||null,
    address:p.formatted||[p.address_line1,p.address_line2].filter(Boolean).join(', ')||null,
    street:p.street||null,housenumber:p.housenumber||null,
    lat,lon,place_id:p.place_id||null,
    categories:Array.isArray(p.categories)?p.categories:[],
    origin:p.datasource?.sourcename||'Geoapify Places / OpenStreetMap'
  };
}
export function findNamedCandidates(group, features) {
  const seen=new Set(), candidates=[];
  for(const f of features||[]) {
    const p=extractPlace(f);
    if(!p||!matchBrand(group,p.name)||!within(p.lat,p.lon,group.rect)) continue;
    const key=p.place_id||String(p.lat.toFixed(6))+','+String(p.lon.toFixed(6));
    if(seen.has(key))continue;
    seen.add(key);candidates.push(p);
  }
  return candidates;
}
export function apiUrl(group,key) {
  const url=new URL('https://api.geoapify.com/v2/places');
  url.searchParams.set('categories',group.category);
  url.searchParams.set('name',group.name);
  url.searchParams.set('filter','rect:'+group.rect.join(','));
  url.searchParams.set('limit','20');
  url.searchParams.set('lang','vi');
  url.searchParams.set('apiKey',key);
  return url;
}
export function flagCoordinateConflicts(rows) {
  const candidates=rows.flatMap(r=>(r.candidates||[]).flatMap(p=>
    r.ids.map(id=>({id,p,group:r.key}))));
  const flagged=new Set();
  for(let i=0;i<candidates.length;i++) for(let j=i+1;j<candidates.length;j++) {
    const a=candidates[i],b=candidates[j];
    if(a.id===b.id)continue;
    // Never use a single building point for two distinct named branches.
    const da=a.p.lat-b.p.lat, db=a.p.lon-b.p.lon;
    const roughlyMetres=Math.sqrt(da*da+db*db)*111195;
    if(roughlyMetres<8&&a.group!==b.group) { flagged.add(a.id); flagged.add(b.id); }
  }
  return [...flagged];
}
export function selfTest() {
  const g=GROUPS[2];
  assert.equal(matchBrand(g,'Nhà thuốc FPT Long Châu - Gành Dầu'),true);
  assert.equal(matchBrand(g,'Nhà Thuốc Linh Chi'),false);
  assert.equal(within(10.37,103.845,g.rect),true);
  assert.equal(within(10.018,104.015,g.rect),false);
  const f={properties:{name:'FPT Long Châu Gành Dầu',lat:10.371,lon:103.843,formatted:'Gành Dầu, Phú Quốc',place_id:'x',categories:['healthcare.pharmacy']}};
  assert.equal(findNamedCandidates(g,[f,f,{properties:{name:'Khách sạn Long Châu',lat:10.02,lon:104.01}}]).length,1);
  assert.equal(apiUrl(g,'TEST').searchParams.get('name'),'Long Châu');
  const conflicting=[
    {key:'a',ids:['utility_longchau_an_thoi'],candidates:[{lat:10.0188911,lon:104.015554}]},
    {key:'b',ids:['utility_tgdd_73_nvc'],candidates:[{lat:10.0188911,lon:104.015554}]}
  ];
  assert.deepEqual(flagCoordinateConflicts(conflicting).sort(),['utility_longchau_an_thoi','utility_tgdd_73_nvc'].sort());
  console.log('Near Me named Places stage2 QA PASS: brand, region, dedupe, collision and no canonical write');
}

export async function run({ root=process.cwd(), key=process.env.GEOAPIFY_API_KEY||'',
    budget=7, fetcher=fetch, now=new Date(), out='.cache/near-go/near-gps-places-stage2.json' }={}) {
  if(!key)throw Error('GEOAPIFY_API_KEY is missing; no requests made');
  if(!Number.isInteger(budget)||budget<1||budget>7)throw Error('Budget must be 1..7');
  const idx=JSON.parse(fs.readFileSync(path.join(root,'data/views/location-index.json'),'utf8'));
  const docs=new Map((idx.documents||[]).map(d=>[d.id,d]));
  const report={
    version:'1.0',generated_at:now.toISOString(),mode:'PLACES_NAME_REGION_RESEARCH_ONLY',
    attribution:'Powered by Geoapify · © OpenStreetMap contributors',
    policy:'Operator address confirms identity, NOT GPS; Geoapify Places derives from OSM and is not an independent second witness. Never write GPS or OPEN directly. Keep conflicting names/areas in review.',
    counts:{groups:GROUPS.length,attempted:0,requests:0,results:0,review_groups:0,no_match:0,skipped:0,failed:0},
    records:[],needs_operator_map:[],coordinate_conflicts:[]
  };
  for(const g of GROUPS) {
    const pending=g.ids.filter(id=>{const d=docs.get(id);return d&&!Number.isFinite(d.map?.lat);});
    if(!pending.length){report.counts.skipped++;continue;}
    if(report.counts.requests>=budget){report.records.push({key:g.key,ids:pending,status:'BUDGET_STOP'});continue;}
    report.counts.attempted++;
    report.counts.requests++;
    try {
      const res=await fetcher(apiUrl(g,key),{signal:AbortSignal.timeout(15000)});
      if(res.status===429){report.rate_limited=true;report.records.push({key:g.key,ids:pending,status:'RATE_LIMITED'});break;}
      if(!res.ok)throw Error('HTTP '+res.status);
      const json=await res.json();
      const list=findNamedCandidates(g,json.features||[]);
      report.counts.results+=list.length;
      if(list.length)report.counts.review_groups++;else report.counts.no_match++;
      report.records.push({key:g.key,ids:pending,name:g.name,region:g.zone,
        category:g.category,status:list.length?'NAMED_POI_REVIEW':'NO_NAMED_POI',
        candidates:list,independent_evidence:false});
    } catch(err) {
      report.counts.failed++;
      report.records.push({key:g.key,ids:pending,status:'API_ERROR_REVIEW_REQUIRED',
        error_name:err?.name==='TimeoutError'?'timeout':'request_failed'});
    }
    if(report.counts.requests<budget)await new Promise(r=>setTimeout(r,550));
  }
  report.coordinate_conflicts=flagCoordinateConflicts(report.records);
  report.needs_operator_map=report.records.filter(r=>r.status==='NAMED_POI_REVIEW').flatMap(r=>r.ids);
  const output=path.resolve(root,out);
  fs.mkdirSync(path.dirname(output),{recursive:true});
  fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({...report.counts,coordinate_conflicts:report.coordinate_conflicts.length,output}));
  return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  if(process.argv.includes('--self-test'))selfTest();
  else run({budget:Number((process.argv.find(x=>x.startsWith('--budget='))||'--budget=7').split('=')[1])})
    .catch(e=>{console.error(e.message);process.exitCode=1;});
}
