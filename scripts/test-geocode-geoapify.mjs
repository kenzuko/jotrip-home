import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { selectPending, assess, requestUrl, buildQuery, run } from './geocode-geoapify.mjs';

const input = { documents: [
  { id: 'pharmacy_1', entity_type: 'utility', utility_type: 'PHARMACY', name: 'Nhà thuốc A', address: '487 Nguyễn Trung Trực, Phú Quốc', map: null },
  { id: 'fuel_1', entity_type: 'utility', utility_type: 'FUEL', name: 'Cây xăng B', address: 'Khu vực Nam đảo', address_precision: 'AREA' },
  { id: 'hotel_1', entity_type: 'hotel', name: 'Hotel C', address: '1 Trần Hưng Đạo' },
  { id: 'pharmacy_2', entity_type: 'utility', utility_type: 'PHARMACY', name: 'Nhà thuốc D', address: '13 Trần Phú', map: { lat: 10.21, lon: 103.95 } },
  { id: 'hotline', entity_type: 'utility', name: '113' },
  { id: 'place_1', entity_type: 'place', name: 'Chợ E', address: '42 ĐT47, Hàm Ninh' }
] };
const selected = selectPending(input);
assert.deepEqual(selected.map(x => x.id), ['pharmacy_1', 'place_1']);
assert.equal(selectPending(input, { includeHotels: true }).length, 3);
const u = requestUrl('Nhà thuốc A', 'TEST_SECRET');
assert.equal(u.hostname, 'api.geoapify.com');
assert.match(u.searchParams.get('filter'), /countrycode:vn/);
assert.match(buildQuery(input.documents[0]), /Phú Quốc/);
const doc = input.documents[0];
const building = { geometry: { coordinates: [103.972, 10.225] }, properties: {
  formatted: '487 Nguyễn Trung Trực, Phú Quốc', lat: 10.225, lon: 103.972,
  housenumber: '487', result_type: 'building',
  rank: { confidence: .94, confidence_building_level: .92, match_type: 'full_match' }
} };
assert.equal(assess(doc, building).review_status, 'PRIORITY_MANUAL_REVIEW');
assert.equal(assess(doc, building).precision_suggestion, 'site_centroid');
assert.equal(assess(doc, { ...building, properties: { ...building.properties, housenumber: '489' } }).review_status, 'ADDRESS_CONFLICT');
assert.equal(assess(doc, { ...building, geometry: { coordinates: [105, 12] }, properties: { ...building.properties, lat: 12, lon: 105 } }), null);
assert.equal(assess(doc, { ...building, properties: { ...building.properties, result_type: 'street' } }).precision_suggestion, 'route_anchor');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'geoapify-test-'));
try {
  fs.mkdirSync(path.join(tmp, 'data/views'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'data/views/location-index.json'), JSON.stringify(input));
  const preview = await run(['--dry-run', '--limit=20'], { root: tmp, now: new Date('2026-09-27T00:00:00Z') });
  assert.equal(preview.stats.selected, 2);
  assert.equal(preview.stats.requests, 0);
  assert.equal(preview.records.every(x => x.status === 'PENDING_NO_REQUEST'), true);
  const originalKey = process.env.GEOAPIFY_API_KEY;
  process.env.GEOAPIFY_API_KEY = 'TEST_SECRET';
  let requests = 0;
  const mockFetch = async () => { requests++; return { ok: true, status: 200, json: async () => ({ features: [building] }) }; };
  const run1 = await run(['--limit=2', '--budget=2'], { root: tmp, fetcher: mockFetch, now: new Date('2026-09-27T00:00:00Z') });
  assert.equal(run1.stats.requests, 2);
  assert.equal(run1.records[0].operator_verified, false);
  assert.equal(JSON.stringify(run1).includes('TEST_SECRET'), false);
  const run2 = await run(['--limit=2', '--budget=2'], { root: tmp, fetcher: mockFetch, now: new Date('2026-09-27T01:00:00Z') });
  assert.equal(run2.stats.cache_hits, 2);
  assert.equal(run2.stats.requests, 0);
  assert.equal(requests, 2);
  if (originalKey === undefined) delete process.env.GEOAPIFY_API_KEY;
  else process.env.GEOAPIFY_API_KEY = originalKey;
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
console.log('Geoapify Near Me QA PASS: selection, island bounds, confidence, address conflict, no-publish, preview and cache');
