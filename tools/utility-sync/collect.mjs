import fs from 'node:fs/promises';

const OUT = new URL('../../data/utilities.json', import.meta.url);
const official = {
  phuquoc: 'https://phuquoc.angiang.gov.vn/trang-chu',
  airport: 'https://acv.vn/phuquocairport/vi/tin-tuc/tin-tuc/thong-bao-so-31-tbpqia-ve-viec-ap-dung-thu-gia-dich-vu-dung-do-o-to-de-don-tra-hanh-khach',
  lost: 'https://acv.vn/phuquocairport/vi/tin-tuc/hanh-ly-that-lac/hanh-ly-that-lac'
};

async function get(url) {
  const r = await fetch(url, { headers: { 'user-agent': 'OpenPhuQuoc-AutoSync/1.0 (+https://openphuquoc.com)' } });
  if (!r.ok) throw new Error(`${url} -> HTTP ${r.status}`);
  return r.text();
}
function cleanPhone(s){ return String(s||'').replace(/\s+/g,' ').trim(); }
function findAround(html,label,regex){
  const i=html.toLowerCase().indexOf(label.toLowerCase());
  const scope=i>=0?html.slice(Math.max(0,i-500),i+1200):html;
  const m=scope.match(regex);
  return m?cleanPhone(m[1]):null;
}

const current = JSON.parse(await fs.readFile(OUT,'utf8'));
const errors=[];

try {
  const html=await get(official.phuquoc);
  const updates = {
    'pq-police': findAround(html,'CÔNG AN ĐẶC KHU',/(0\d[\d\.\s]{8,14})/i),
    'pq-tourism': findAround(html,'VĂN HÓA - XÃ HỘI',/(0\d[\d\.\s]{8,14})/i),
    'pq-hcc': findAround(html,'TRUNG TÂM PHỤC VỤ HCC',/(0\d[\d\.\s]{8,14})/i)
  };
  current.phu_quoc=current.phu_quoc.map(x=>updates[x.id]?{...x,phone:updates[x.id].replace(/\./g,' '),last_checked:new Date().toISOString()}:x);
} catch(e){ errors.push(String(e)); }

try {
  const html=await get(official.airport);
  const phones=[...html.matchAll(/(?:0\d{3,4}[\.\s]?\d{2,3}[\.\s]?\d{3})/g)].map(x=>cleanPhone(x[0]).replace(/\./g,' '));
  if(phones.length){
    current.phu_quoc=current.phu_quoc.map(x=>x.id==='pqc-hotline'?{...x,phone:phones[0],phone_alt:phones[1]||x.phone_alt,last_checked:new Date().toISOString()}:x);
  }
} catch(e){ errors.push(String(e)); }

try {
  const html=await get(official.lost);
  const m=html.match(/0963[\.\s]?975[\.\s]?644/);
  if(m) current.phu_quoc=current.phu_quoc.map(x=>x.id==='pqc-lost'?{...x,phone:'0963 975 644',last_checked:new Date().toISOString()}:x);
} catch(e){ errors.push(String(e)); }

current.generated_at=new Date().toISOString();
current.sync={status:errors.length?'PARTIAL':'OK',errors,source_count:3};
await fs.writeFile(OUT,JSON.stringify(current,null,2)+'\n');
console.log(JSON.stringify({status:current.sync.status,errors},null,2));
