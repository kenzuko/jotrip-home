/**
 * Open Phu Quoc Near Me GPS lookup - Geoapify staging only.
 * Never writes canonical entities or publishes unverified geocoded coordinates.
 * Usage: node scripts/geocode-geoapify.mjs --dry-run
 *        GEOAPIFY_API_KEY=... node scripts/geocode-geoapify.mjs --limit=50 --budget=150
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
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
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
  const stats = { total_pending: all.length, selected: pending.length, requests: 0, cache_hits: 0, candidates: 0, no_results: 0, failed: 0 };
  const meta = { schema_version: '1.0', generated_at: now.toISOString(), provider: 'Geoapify',
    attribution: 'Powered by Geoapify · © OpenStreetMap contributors',
    publication_status: 'RESEARCH_ONLY_NOT_PUBLISHED', dry_run: dryRun,
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
      stats.requests++;
      await delay(500); // At most two ordinary requests per second.
    }
    if (stop) break;
    candidates = candidates || [];
    stats.candidates += candidates.length;
    if (!candidates.length) stats.no_results++;
    meta.records.push({ entity_id: doc.id, name: doc.name, address: doc.address,
      type: doc.utility_type || doc.entity_type, query, queried_at: now.toISOString(),
      status: candidates.length ? 'NEEDS_REVIEW' : 'NO_MATCH',
      official_source_check_required: true, operator_verified: false,
      exact_entrance_verified: false, operational_status: doc.operational_status || 'UNKNOWN',
      candidates });
    // Save incrementally; an interrupted job must not spend the same requests again.
    writeJson(cachePath, cache);
    writeJson(out, meta);
  }
  writeJson(cachePath, cache);
  writeJson(out, meta);
  console.log(JSON.stringify({ ...stats, dry_run: false, output: out, cache: cachePath }));
  return meta;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  run().catch(error => { console.error(error.message); process.exitCode = 1; });
}
