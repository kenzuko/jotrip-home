/**
 * Open Phu Quoc Near Me geocode to canonical coordinates (Geoapify).
 * Never overwrites existing GPS; only street-numbered high-confidence buildings
 * can be saved as site centroids. Broad/unmatched results remain in a review report.
 * Usage: node scripts/geocode-geoapify.mjs --dry-run
 *        GEOAPIFY_API_KEY=... node scripts/geocode-geoapify.mjs --apply --limit=50 --budget=150
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const PQ_BOUNDS = { west: 103.75, south: 9.80, east: 104.25, north: 10.55 };
const ROOT = process.cwd();
const DEFAULT_OUT = '.cache/near-go/geoapify-candidates.json';
const DEFAULT_CACHE = '.cache/near-go/geoapify-cache.json';
const CACHE_TTL_MS = 90 * 86400_000;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export function isOnIsland(lat, lon) {
  return Number.isFinite(lat) && Number.isFinite(lon) &&
    lat >= PQ_BOUNDS.south && lat <= PQ_BOUNDS.north &&
    lon >= PQ_BOUNDS.west && lon <= PQ_BOUNDS.east;
}

export function hasGps(doc) {
  return Number.isFinite(doc.map?.lat) && Number.isFinite(doc.map?.lon) &&
    isOnIsland(doc.map.lat, doc.map.lon);
}

export function cleanAddress(value = '') {
  return String(value)
    .replace(/Đặc khu Phú Quốc/gi, 'Phú Quốc')
    .replace(/thành phố Phú Quốc/gi, 'Phú Quốc')
    .replace(/(?:tỉnh )?(?:An Giang|Kiên Giang)/gi, '')
    .replace(/\s*,\s*,+/g, ', ')
    .replace(/\s{2,}/g, ' ').replace(/^\s*,|,\s*$/g, '').trim();
}

export function isGeocodableAddress(doc) {
  if (!doc.address || !String(doc.address).trim()) return false;
  if (doc.address_is_approximate || doc.address_precision === 'AREA') return false;
  // An area description must not silently become a precise business pin.
  if (/^(?:khu vực|gần |quanh |khu |phường |xã )/i.test(doc.address.trim())) return false;
  return true;
}

export function priority(doc) {
  const type = doc.utility_type || '';
  const preferred = ['CLINIC_HOSPITAL', 'PHARMACY', 'FUEL', 'CHARGING', 'ATM'];
  const rank = preferred.indexOf(type);
  return rank === -1 ? (doc.entity_type === 'utility' ? 10 : 20) : rank;
}

export function selectPending(index, { includeHotels = false } = {}) {
  const types = new Set(includeHotels ? ['utility', 'place', 'hotel'] : ['utility', 'place']);
  const seen = new Set();
  return (index.documents || []).filter(doc => {
    if (!types.has(doc.entity_type) || !doc.id || seen.has(doc.id)) return false;
    seen.add(doc.id);
    if (hasGps(doc) || !isGeocodableAddress(doc)) return false;
    if (doc.entity_type === 'utility' && ['HOTLINE', 'SERVICE_PHONE'].includes(doc.utility_type)) return false;
    return true;
  }).sort((a, b) => priority(a) - priority(b) || a.id.localeCompare(b.id));
}

export function buildQuery(doc) {
  const address = cleanAddress(doc.address);
  const parts = [doc.name, address];
  if (!/phú quốc|phu quoc/i.test(address)) parts.push('Phú Quốc');
  parts.push('Việt Nam');
  return parts.filter(Boolean).join(', ');
}

export function requestUrl(query, apiKey) {
  const u = new URL('https://api.geoapify.com/v1/geocode/search');
  u.searchParams.set('text', query);
  u.searchParams.set('filter', `rect:${PQ_BOUNDS.west},${PQ_BOUNDS.south},${PQ_BOUNDS.east},${PQ_BOUNDS.north}|countrycode:vn`);
  u.searchParams.set('bias', 'proximity:103.967,10.227');
  u.searchParams.set('lang', 'vi');
  u.searchParams.set('limit', '3');
  u.searchParams.set('apiKey', apiKey);
  return u;
}

function normalizedText(s = '') {
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
}

export function assess(doc, feature) {
  const p = feature?.properties || {};
  const coords = feature?.geometry?.coordinates || [];
  const lat = Number(p.lat ?? coords[1]);
  const lon = Number(p.lon ?? coords[0]);
  if (!isOnIsland(lat, lon)) return null;
  const rank = p.rank || {};
  const confidence = Number.isFinite(Number(rank.confidence)) ? Number(rank.confidence) : null;
  const level = p.result_type || 'unknown';
  const match = rank.match_type || 'unknown';
  const inputNumber = cleanAddress(doc.address).match(/(?:^|,\s*|\s)(\d+[A-Za-z]?(?:-\d+[A-Za-z]?)?)(?=\s|,|$)/)?.[1];
  const outputNumber = p.housenumber ? String(p.housenumber).trim() : null;
  const numberConflict = !!(inputNumber && outputNumber && normalizedText(inputNumber) !== normalizedText(outputNumber));
  const locationLevel = ['amenity', 'building'].includes(level) ? 'SITE' : ['street', 'suburb'].includes(level) ? 'STREET' : 'AREA';
  const goodBuilding = locationLevel === 'SITE' && !numberConflict &&
    confidence !== null && confidence >= 0.85 &&
    ['full_match', 'match_by_building'].includes(match) &&
    (rank.confidence_building_level == null || Number(rank.confidence_building_level) >= 0.8);
  const review = numberConflict ? 'ADDRESS_CONFLICT' : goodBuilding ? 'PRIORITY_MANUAL_REVIEW' : 'MANUAL_REVIEW';
  return {
    lat, lon, formatted: p.formatted || null,
    name: p.name || null, housenumber: outputNumber, street: p.street || null,
    result_type: level, confidence, building_confidence: rank.confidence_building_level ?? null,
    street_confidence: rank.confidence_street_level ?? null,
    match_type: match, location_level: locationLevel, review_status: review,
    precision_suggestion: locationLevel === 'SITE' ? 'site_centroid' : locationLevel === 'STREET' ? 'route_anchor' : 'area_anchor',
    warning: numberConflict ? 'Input street number conflicts with Geoapify' :
      locationLevel !== 'SITE' ? 'Area/street anchor, not a business entrance' :
      'Geocoded site estimate, NOT operator-verified or an exact entrance',
    provider: 'Geoapify / OpenStreetMap',
    provider_url: 'https://www.geoapify.com/',
    raw_place_id: p.place_id || null
  };
}

/** Only persist a street-numbered, high-confidence building point to canonical data. */
export function eligibleForSave(doc, candidate) {
  if (!candidate || candidate.review_status !== 'PRIORITY_MANUAL_REVIEW' ||
      candidate.location_level !== 'SITE' || candidate.precision_suggestion !== 'site_centroid') return false;
  // "Thửa đất 19" or "ngã tư" are not a street number and must not be auto-pinned.
  const raw = String(doc.address || '').trim();
  const number = raw.match(/^(\d+[A-Za-z]?(?:-\d+[A-Za-z]?)?)(?=\s|,|$)/)?.[1];
  if (!number || !candidate.housenumber || normalizedText(number) !== normalizedText(candidate.housenumber)) return false;
  // A matching number on a different street is not the same address.
  if (!candidate.street || !normalizedText(raw).includes(normalizedText(candidate.street))) return false;
  const brand = x => {
    const n = normalizedText(x);
    if (/long chau/.test(n)) return 'LONG_CHAU';
    if (/the gioi di dong/.test(n)) return 'TGDD';
    if (/dien may xanh/.test(n)) return 'DMX';
    if (/vietcombank/.test(n)) return 'VCB';
    if (/dng/.test(n)) return 'DNG';
    return null;
  };
  if (candidate.name && brand(candidate.name) && brand(candidate.name) !== brand(doc.name))
    return false;
  if (candidate.street_confidence !== null && candidate.street_confidence !== undefined &&
      Number(candidate.street_confidence) < .8) return false;
  if (doc.zone_id === 'zone_south' && candidate.lat > 10.13) return false;
  if (doc.zone_id === 'zone_north' && candidate.lat < 10.24) return false;
  if (doc.zone_id === 'zone_central_west' &&
      (candidate.lat < 10.10 || candidate.lat > 10.31 || candidate.lon > 104.035)) return false;
  return isOnIsland(candidate.lat, candidate.lon);
}

function metersBetween(a, b) {
  const deg = Math.PI / 180, dlat = (a.lat - b.lat) * deg, dlon = (a.lon - b.lon) * deg;
  const x = Math.sin(dlat / 2) ** 2 + Math.cos(a.lat * deg) * Math.cos(b.lat * deg) * Math.sin(dlon / 2) ** 2;
  return 12742000 * Math.asin(Math.sqrt(x));
}

export function saveExactStreetCandidate(doc, candidates, { root, now, occupied = [] }) {
  const eligible = (candidates || []).filter(c => eligibleForSave(doc, c));
  if (eligible.length !== 1) return { status: 'REVIEW_REQUIRED', reason: eligible.length ? 'MULTIPLE_STRONG_MATCHES' : 'NO_STRONG_BUILDING_MATCH' };
  const c = eligible[0];
  if (occupied.some(o => o.id !== doc.id && metersBetween(o, c) < 20 &&
      normalizedText(o.address || '') !== normalizedText(doc.address || ''))) {
    return { status: 'REVIEW_REQUIRED', reason: 'NEAR_EXISTING_DIFFERENT_ADDRESS' };
  }
  const dir = path.join(root, 'data', 'entities');
  for (const filename of fs.readdirSync(dir).filter(n => n.endsWith('.json')).sort()) {
    const file = path.join(dir, filename), data = readJson(file);
    const entity = (data.entities || []).find(e => e.id === doc.id);
    if (!entity) continue;
    if (entity.address !== doc.address) return { status: 'REVIEW_REQUIRED', reason: 'CANONICAL_ADDRESS_CHANGED' };
    // Never overwrite a coordinate already present in a canonical record.
    if (Number.isFinite(entity.map?.lat) && Number.isFinite(entity.map?.lon))
      return { status: 'ALREADY_HAS_GPS' };
    entity.map = {
      lat: c.lat, lon: c.lon, precision: 'site_centroid',
      source: 'Geoapify Geocoding / OpenStreetMap contributors',
      source_id: 'geoapify_address_geocode', verified_at: now.toISOString().slice(0, 10),
      accuracy: `geoapify_building_confidence_${c.confidence}`,
      note: 'Tọa độ tòa nhà suy từ địa chỉ qua Geoapify. Chưa xác minh cửa vào hay hoạt động của cơ sở.'
    };
    // Address and operational/verified fields remain unchanged.
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
    occupied.push({ id: entity.id, address: entity.address, lat: c.lat, lon: c.lon });
    return { status: 'SAVED_SITE_ESTIMATE', entity_id: doc.id, file: path.relative(root, file),
      lat: c.lat, lon: c.lon, precision: 'site_centroid' };
  }
  return { status: 'REVIEW_REQUIRED', reason: 'CANONICAL_ID_NOT_FOUND' };
}


/**
 * A geocoder may resolve different numbered businesses to the same POI/tower.
 * Detect cross-entity collisions before writing any canonical JSON. Both points
 * stay in review, including when the second result is too weak for auto-save.
 */
export function crossEntityCollisions(doc, candidates, staged, radiusMeters = 15) {
  const wanted = (candidates || []).filter(c => eligibleForSave(doc, c));
  const out = new Set();
  for (const c of wanted) {
    for (const other of staged) {
      if (doc.id === other.doc.id ||
          normalizedText(doc.address) === normalizedText(other.doc.address)) continue;
      for (const x of other.candidates || []) {
        if (!Number.isFinite(x.lat) || !Number.isFinite(x.lon) ||
            x.location_level !== 'SITE') continue;
        if (metersBetween(c, x) <= radiusMeters) out.add(other.doc.id);
      }
    }
  }
  return [...out].sort();
}

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
function writeJson(file, payload) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(tmp, file);
}
function option(args, name, fallback) {
  const found = args.find(x => x.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : fallback;
}
function boundedInteger(value, fallback, max) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

export async function run(argv = process.argv.slice(2), { fetcher = fetch, root = ROOT, now = new Date() } = {}) {
  const dryRun = argv.includes('--dry-run');
  const apply = argv.includes('--apply');
  if (dryRun && apply) throw new Error('Choose --dry-run or --apply, not both.');
  const includeHotels = argv.includes('--include-hotels');
  const limit = boundedInteger(option(argv, 'limit', '50'), 50, 200);
  // Reserved for THIS run; Geoapify's 3,000 credits/day are shared with other projects.
  const budget = boundedInteger(option(argv, 'budget', '150'), 150, 1000);
  const input = path.resolve(root, option(argv, 'input', 'data/views/location-index.json'));
  const out = path.resolve(root, option(argv, 'out', DEFAULT_OUT));
  const cachePath = path.resolve(root, option(argv, 'cache', DEFAULT_CACHE));
  const apiKey = process.env.GEOAPIFY_API_KEY || '';
  const index = readJson(input);
  const all = selectPending(index, { includeHotels });
  const skipped = (index.documents || []).filter(x =>
    ['utility', 'place', ...(includeHotels ? ['hotel'] : [])].includes(x.entity_type) &&
    !hasGps(x) && !isGeocodableAddress(x)
  ).map(x => ({ entity_id: x.id, name: x.name, address: x.address || null,
    status: 'ADDRESS_NEEDS_MORE_DETAIL', reason: x.address_precision === 'AREA' ? 'AREA_ONLY' : 'MISSING_OR_VAGUE_ADDRESS' }));
  const pending = all.slice(0, limit);
  const stats = { total_pending: all.length, selected: pending.length, requests: 0, cache_hits: 0, candidates: 0, no_results: 0, failed: 0, saved: 0, review_required: 0 };
  const meta = { schema_version: '1.0', generated_at: now.toISOString(), provider: 'Geoapify',
    attribution: 'Powered by Geoapify · © OpenStreetMap contributors',
    publication_status: 'GEOCODE_ONLY_NOT_OPERATOR_VERIFIED', dry_run: dryRun, apply,
    policy: 'Review official operator map/address first. Geocoding alone never verifies exact entrance or opening status.',
    stats, skipped, records: [] };
  if (dryRun) {
    meta.records = pending.map(x => ({ entity_id: x.id, name: x.name, address: x.address, type: x.utility_type || x.entity_type, query: buildQuery(x), status: 'PENDING_NO_REQUEST' }));
    writeJson(out, meta);
    console.log(JSON.stringify({ ...stats, dry_run: true, output: out }));
    return meta;
  }
  if (!apiKey) throw new Error('GEOAPIFY_API_KEY missing. Create a free Geoapify key and set it as a GitHub Actions secret.');
  let cache = { schema_version: '1.0', entries: {} };
  if (fs.existsSync(cachePath)) {
    try { cache = readJson(cachePath); if (!cache.entries || typeof cache.entries !== 'object') cache.entries = {}; }
    catch { console.warn('WARN: unreadable cache; continuing without it'); }
  }
  let stop = false;
  const staged = [];
  const occupied = (index.documents || []).filter(d => hasGps(d))
    .map(d => ({ id: d.id, address: d.address || '', lat: d.map.lat, lon: d.map.lon }));
  for (const doc of pending) {
    if (stop) break;
    const query = buildQuery(doc);
    const key = crypto.createHash('sha256').update(JSON.stringify([doc.id, query, 'geoapify-v1'])).digest('hex');
    const cached = cache.entries[key];
    let candidates;
    if (cached && Date.parse(cached.fetched_at) + CACHE_TTL_MS > now.valueOf()) {
      stats.cache_hits++; candidates = cached.candidates;
    } else {
      if (stats.requests >= budget) { stats.budget_exhausted = true; break; }
      const url = requestUrl(query, apiKey);
      for (let attempt = 0; attempt < 3; attempt++) {
        if (stats.requests >= budget) { stats.budget_exhausted = true; stop = true; break; }
        stats.requests++; // Count real outbound calls, including failed/retried requests.
        try {
          // No raw API URL or key in logs, report or cache.
          const response = await fetcher(url, { signal: AbortSignal.timeout(15000) });
          if (response.status === 429) {
            stats.rate_limited = true;
            stop = true;
            break;
          }
          if (response.status >= 500 && attempt < 2) { await delay((attempt + 1) * 1200); continue; }
          if (!response.ok) throw new Error(`Geoapify HTTP ${response.status}`);
          const body = await response.json();
          candidates = (body.features || []).map(f => assess(doc, f)).filter(Boolean);
          cache.entries[key] = { fetched_at: now.toISOString(), candidates };
          break;
        } catch (error) {
          if (attempt === 2) {
            stats.failed++;
            console.warn(`WARN ${doc.id}: ${error.name === 'TimeoutError' ? 'timeout' : String(error.message).replace(apiKey, '[redacted]')}`);
          } else await delay((attempt + 1) * 1200);
        }
      }
      await delay(500); // At most two ordinary requests per second.
    }
    if (stop) break;
    candidates = candidates || [];
    stats.candidates += candidates.length;
    if (!candidates.length) stats.no_results++;
    // Do not write a site before checking other selected records for reused
    // coordinates, including weak candidates with conflicting house numbers.
    const save = { status: apply && candidates.length ? 'PENDING_PREFLIGHT' :
      candidates.length ? 'SUGGESTION_ONLY' : 'NO_MATCH' };
    const record = { entity_id: doc.id, name: doc.name, address: doc.address,
      type: doc.utility_type || doc.entity_type, query, queried_at: now.toISOString(),
      status: save.status, save_result: save,
      official_source_check_required: true, operator_verified: false,
      exact_entrance_verified: false, operational_status: doc.operational_status || 'UNKNOWN',
      candidates };
    meta.records.push(record);
    if (apply && candidates.length) staged.push({ doc, candidates, record });
    // Save incrementally; an interrupted job must not spend the same requests again.
    writeJson(cachePath, cache);
    writeJson(out, meta);
  }
  // Preflight all candidate coordinates before saving even one canonical record.
  // This avoids writing house 46 when Geoapify gave the same point as house 73.
  for (const { doc, candidates, record } of staged) {
    const conflictIds = crossEntityCollisions(doc, candidates, staged);
    const save = conflictIds.length
      ? { status: 'REVIEW_REQUIRED', reason: 'CROSS_ENTITY_COORDINATE_COLLISION',
          conflicting_entity_ids: conflictIds }
      : saveExactStreetCandidate(doc, candidates, { root, now, occupied });
    record.status = save.status;
    record.save_result = save;
    if (save.status === 'SAVED_SITE_ESTIMATE') stats.saved++;
    if (save.status === 'REVIEW_REQUIRED') stats.review_required++;
  }
  writeJson(cachePath, cache);
  writeJson(out, meta);
  console.log(JSON.stringify({ ...stats, dry_run: false, apply, output: out, cache: cachePath }));
  return meta;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  run().catch(error => { console.error(error.message); process.exitCode = 1; });
}
