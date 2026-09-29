import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const sha256 = text => crypto.createHash('sha256').update(String(text), 'utf8').digest('hex');

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--')) continue;
    const key = k.slice(2);
    const next = argv[i + 1];
    out[key] = next && !next.startsWith('--') ? argv[++i] : true;
  }
  return out;
}

function getAt(obj, dotPath) {
  let cur = obj;
  for (const part of String(dotPath).split('.').filter(Boolean)) {
    if (cur == null || !(part in cur)) return undefined;
    cur = cur[part];
  }
  return cur;
}

function setAt(obj, dotPath, value) {
  const parts = String(dotPath).split('.').filter(Boolean);
  if (!parts.length) throw new Error('Empty path');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur[parts[i]] == null || typeof cur[parts[i]] !== 'object') {
      throw new Error('Invalid path: ' + dotPath);
    }
    cur = cur[parts[i]];
  }
  cur[parts.at(-1)] = value;
}

function inferLocks(text, record = {}) {
  const locks = new Set();
  const value = String(text ?? '');
  const name = typeof record.name === 'string' ? record.name.trim() : '';
  if (name && value.includes(name)) locks.add(name);
  for (const m of value.matchAll(/https?:\/\/[^\s)\]}> ,]+/g)) locks.add(m[0]);
  for (const m of value.matchAll(/\b\d{1,2}:\d{2}\b/g)) locks.add(m[0]);
  for (const m of value.matchAll(/\b\d+(?:[.,]\d+)?\s?(?:%|km|m|cm|mm|kg|g|ml|l|VND|đ|₫)\b/gi)) locks.add(m[0]);
  for (const m of value.matchAll(/\b\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?\b/g)) locks.add(m[0]);
  return [...locks];
}

function safeMeta(value) {
  return String(value ?? '').replace(/-->/g, '-- >').replace(/[\r\n]+/g, ' ').trim();
}

function buildBlocks({ sourcePath, sourceSha = '', recordPath, idField = 'id', recordId, fields, data }) {
  const records = getAt(data, recordPath);
  if (!Array.isArray(records)) throw new Error('record-path is not an array: ' + recordPath);
  const index = records.findIndex(r => String(r?.[idField] ?? '') === String(recordId));
  if (index < 0) throw new Error('Record not found: ' + recordId);
  const record = records[index];

  return fields.map((field, i) => {
    const original = getAt(record, field);
    if (typeof original !== 'string') throw new Error('Field is not a string: ' + field);
    return {
      n: i + 1,
      id: recordPath + '.' + recordId + '.' + field,
      sourcePath,
      sourceSha,
      pointer: recordPath + '.' + index + '.' + field,
      hash: sha256(original),
      locks: inferLocks(original, record),
      original,
      rewrite: ''
    };
  });
}

function renderPack(meta, blocks) {
  const lines = [
    '# OPEN PHU QUOC - REWRITE PACK',
    '',
    '<!-- OPENPQ_REWRITE_PACK:1 -->',
    '<!-- SOURCE:' + safeMeta(meta.sourcePath) + ' -->',
    '<!-- SOURCE_SHA:' + safeMeta(meta.sourceSha || '') + ' -->',
    '<!-- RECORD_PATH:' + safeMeta(meta.recordPath) + ' -->',
    '<!-- RECORD_ID:' + safeMeta(meta.recordId) + ' -->',
    '',
    '> Chỉ điền nội dung giữa [REWRITE] và [/REWRITE]. Không sửa ID, ORIGINAL hoặc metadata.',
    '> Viết lại tiếng Việt tự nhiên, gọn, hữu ích. Không thêm fact mới. Giữ nguyên các dữ kiện bị khóa.',
    ''
  ];

  for (const b of blocks) {
    lines.push(
      '## BLOCK ' + String(b.n).padStart(3, '0'),
      '<!-- ID:' + safeMeta(b.id) + ' -->',
      '<!-- POINTER:' + safeMeta(b.pointer) + ' -->',
      '<!-- HASH:' + b.hash + ' -->',
      '<!-- LOCKS:' + safeMeta(JSON.stringify(b.locks)) + ' -->',
      '[ORIGINAL]',
      b.original,
      '[/ORIGINAL]',
      '[REWRITE]',
      '',
      '[/REWRITE]',
      ''
    );
  }
  return lines.join('\n');
}

function parsePack(text) {
  const pack = String(text ?? '');
  if (!pack.includes('<!-- OPENPQ_REWRITE_PACK:1 -->')) {
    throw new Error('Not an OPENPQ rewrite pack v1');
  }

  const re = /(?:#{1,6}\s*)?BLOCK\s+\d+[\s\S]*?<!-- ID:([^\n]*?) -->[\s\S]*?<!-- POINTER:([^\n]*?) -->[\s\S]*?<!-- HASH:([a-f0-9]{64}) -->[\s\S]*?<!-- LOCKS:([^\n]*?) -->[\s\S]*?\[ORIGINAL\]\n([\s\S]*?)\n\[\/ORIGINAL\][\s\S]*?\[REWRITE\]\n([\s\S]*?)\n\[\/REWRITE\]/g;
  const blocks = [];
  for (const m of pack.matchAll(re)) {
    let locks = [];
    try { locks = JSON.parse(m[4].trim()); }
    catch { throw new Error('Invalid LOCKS for ' + m[1].trim()); }
    blocks.push({
      id: m[1].trim(),
      pointer: m[2].trim(),
      hash: m[3],
      locks,
      original: m[5],
      rewrite: m[6].trim()
    });
  }
  if (!blocks.length) throw new Error('No rewrite blocks found');
  return blocks;
}

function validateAndApply(data, blocks) {
  const next = structuredClone(data);
  const report = [];

  for (const b of blocks) {
    const current = getAt(next, b.pointer);
    if (typeof current !== 'string') {
      report.push({ id: b.id, status: 'error', reason: 'pointer_missing' });
      continue;
    }
    if (sha256(current) !== b.hash || current !== b.original) {
      report.push({ id: b.id, status: 'error', reason: 'source_changed' });
      continue;
    }
    if (!b.rewrite) {
      report.push({ id: b.id, status: 'skipped', reason: 'empty_rewrite' });
      continue;
    }

    const missing = (Array.isArray(b.locks) ? b.locks : []).filter(token => !b.rewrite.includes(token));
    if (missing.length) {
      report.push({ id: b.id, status: 'error', reason: 'lock_missing', missing });
      continue;
    }
    if (/\u2013|\u2014/.test(b.rewrite)) {
      report.push({ id: b.id, status: 'error', reason: 'forbidden_dash' });
      continue;
    }

    setAt(next, b.pointer, b.rewrite);
    report.push({ id: b.id, status: 'ready' });
  }

  return {
    data: next,
    report,
    ok: report.every(r => r.status === 'ready' || r.status === 'skipped')
  };
}

function runExport(a) {
  for (const key of ['source', 'record-path', 'id', 'fields', 'out']) {
    if (!a[key]) throw new Error('Missing --' + key);
  }
  const data = JSON.parse(fs.readFileSync(path.resolve(a.source), 'utf8'));
  const fields = String(a.fields).split(',').map(x => x.trim()).filter(Boolean);
  const blocks = buildBlocks({
    sourcePath: a.source,
    sourceSha: a['source-sha'] || '',
    recordPath: a['record-path'],
    idField: a['id-field'] || 'id',
    recordId: a.id,
    fields,
    data
  });
  const md = renderPack({
    sourcePath: a.source,
    sourceSha: a['source-sha'] || '',
    recordPath: a['record-path'],
    recordId: a.id
  }, blocks);

  const out = path.resolve(a.out);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, md, 'utf8');
  console.log('Exported ' + blocks.length + ' blocks -> ' + a.out);
}

function runImport(a) {
  for (const key of ['source', 'input']) {
    if (!a[key]) throw new Error('Missing --' + key);
  }
  const data = JSON.parse(fs.readFileSync(path.resolve(a.source), 'utf8'));
  const blocks = parsePack(fs.readFileSync(path.resolve(a.input), 'utf8'));
  const result = validateAndApply(data, blocks);

  for (const row of result.report) {
    const extra = row.missing?.length ? ' (' + row.missing.join(', ') + ')' : '';
    console.log((row.status.toUpperCase() + ' ' + row.id + ' ' + (row.reason || '') + extra).trim());
  }

  if (!result.ok) {
    console.error('Import blocked. Fix errors before review.');
    process.exitCode = 2;
    return;
  }
  if (!a.out) {
    console.log('Check passed. No canonical file was modified.');
    return;
  }

  const out = path.resolve(a.out);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(result.data, null, 2) + '\n', 'utf8');
  console.log('Candidate written -> ' + a.out);
}

function runSelfTest() {
  const source = {
    dishes: [{
      id: 'goi-ca-trich',
      name: 'Gỏi cá trích',
      intro: 'Gỏi cá trích là món quen thuộc ở Phú Quốc. Giá 100.000 đ.',
      tips: ['Ăn lúc 12:30.']
    }]
  };

  const blocks = buildBlocks({
    sourcePath: 'food.json',
    sourceSha: 'abc',
    recordPath: 'dishes',
    recordId: 'goi-ca-trich',
    fields: ['intro', 'tips.0'],
    data: source
  });

  let pack = renderPack({
    sourcePath: 'food.json',
    sourceSha: 'abc',
    recordPath: 'dishes',
    recordId: 'goi-ca-trich'
  }, blocks);

  pack = pack
    .replace('[REWRITE]\n\n[/REWRITE]', '[REWRITE]\nGỏi cá trích là món dễ gặp ở Phú Quốc. Giá 100.000 đ.\n[/REWRITE]')
    .replace('[REWRITE]\n\n[/REWRITE]', '[REWRITE]\nĂn lúc 12:30 là vừa.\n[/REWRITE]');

  const good = validateAndApply(source, parsePack(pack));
  if (!good.ok || !/dễ gặp/.test(good.data.dishes[0].intro)) throw new Error('self-test failed: good case');

  const changed = structuredClone(source);
  changed.dishes[0].intro += ' Đã sửa.';
  if (validateAndApply(changed, parsePack(pack)).ok) throw new Error('self-test failed: source change');

  const bad = parsePack(pack);
  bad[0].rewrite = 'Món này khá phổ biến.';
  if (validateAndApply(source, bad).ok) throw new Error('self-test failed: lock');

  console.log('rewrite queue prototype: ok');
}

const [command] = process.argv.slice(2);
const a = parseArgs(process.argv);
if (command === 'export') runExport(a);
else if (command === 'import') runImport(a);
else if (command === 'test') runSelfTest();
else {
  console.log('Usage:');
  console.log('  node scripts/rewrite-queue-prototype.mjs export --source ... --record-path ... --id ... --fields ... --out ...');
  console.log('  node scripts/rewrite-queue-prototype.mjs import --source ... --input ... [--out candidate.json]');
  console.log('  node scripts/rewrite-queue-prototype.mjs test');
  process.exitCode = 1;
}
