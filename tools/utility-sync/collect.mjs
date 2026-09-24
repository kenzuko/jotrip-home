import fs from 'node:fs/promises';

const OUT = new URL('../../data/utilities.json', import.meta.url);
const sources = {
  'pq-police': { url: 'https://phuquoc.angiang.gov.vn/trang-chu', phone: '0988 014 569' },
  'pq-tourism': { url: 'https://phuquoc.angiang.gov.vn/phong-ban-chuyen-mon-0', phone: '0297 384 6331' },
  'pq-hcc': { url: 'https://phuquoc.angiang.gov.vn/thong-bao-vv-cong-khai-duong-day-nong-tai-trung-tam-phuc-vu-hanh-chinh-cong', phone: '0297 399 9179' },
  'pqc-hotline': { url: 'https://sunairport.com/en/phuquoc/contact-us', phone: '0984 984 341' },
  'pqc-lost': { url: 'https://sunairport.com/en/phuquoc/guides/baggage-services', phone: '0984 984 341' }
};
const directorySources = {
  superdong: 'https://online.superdong.com.vn/Home/Contact',
  pqexpress: 'https://phuquocexpress.com/',
  thanhthoi: 'https://thanhthoi.vn/',
  vinwonders: 'https://vinwonders.com/en/contact/',
  sunworld: 'https://sunworld.vn/vi/hon-thom',
  vinmec: 'https://www.vinmec.com/eng/hospital/vinmec-phu-quoc-hospital'
};
async function get(url) {
  const r = await fetch(url, { headers: { 'user-agent': 'OpenPhuQuoc-AutoSync/1.0 (+https://openphuquoc.com)' } });
  if (!r.ok) throw new Error(`${url} -> HTTP ${r.status}`);
  return r.text();
}
const digits = value => String(value || '').replace(/\\D/g, '');
const current = JSON.parse(await fs.readFile(OUT, 'utf8'));
const errors = [];
for (const item of current.phu_quoc || []) {
  const source = sources[item.id];
  if (!source) continue;
  try {
    const html = await get(source.url);
    item.verified = digits(html).includes(digits(source.phone));
    item.last_checked = new Date().toISOString();
    item.source = source.url;
    if (!item.verified) errors.push(`Official source no longer shows the listed number: ${item.id}`);
  } catch (error) {
    errors.push(String(error));
    item.verified = false;
    item.last_checked = new Date().toISOString();
  }
}
for (const item of current.directory || []) {
  const url = directorySources[item.id === 'vinmec-er' ? 'vinmec' : item.id];
  if (!url) continue;
  try {
    const html = await get(url);
    const expected = digits(item.phone);
    item.verified = expected ? digits(html).includes(expected) : false;
    item.checked_at = new Date().toISOString();
    item.source = url;
  } catch (error) {
    errors.push(String(error));
    item.verified = false;
    item.checked_at = new Date().toISOString();
  }
}
current.generated_at = new Date().toISOString();
current.sync = {
  status: errors.length ? 'PARTIAL' : 'OK',
  errors,
  source_count: Object.keys(sources).length + Object.keys(directorySources).length,
  note: 'Phone numbers are curated from current official sources; auto-sync only verifies exact numbers and never replaces them with a guessed number.'
};
await fs.writeFile(OUT, JSON.stringify(current, null, 2) + '\\n');
console.log(JSON.stringify({ status: current.sync.status, errors }, null, 2));
