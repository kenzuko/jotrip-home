import crypto from 'node:crypto';

export function sha256(text){
  return crypto.createHash('sha256').update(String(text),'utf8').digest('hex');
}

export function getAt(obj, path){
  const parts = String(path).split('.').filter(Boolean);
  let cur = obj;
  for (const p of parts){
    if (cur == null || !(p in cur)) return undefined;
    cur = cur[p];
  }
  return cur;
}

export function setAt(obj, path, value){
  const parts = String(path).split('.').filter(Boolean);
  if (!parts.length) throw new Error('Empty path');
  let cur = obj;
  for (let i=0;i<parts.length-1;i++){
    const p = parts[i];
    if (cur[p] == null || typeof cur[p] !== 'object') throw new Error(`Invalid path: ${path}`);
    cur = cur[p];
  }
  cur[parts.at(-1)] = value;
}

export function inferLocks(original, record={}){
  const locks = new Set();
  const text = String(original ?? '');
  const name = typeof record.name === 'string' ? record.name.trim() : '';
  if (name && text.includes(name)) locks.add(name);
  for (const match of text.matchAll(/https?:\/\/[^\s)\]}>,]+/g)) locks.add(match[0]);
  for (const match of text.matchAll(/\b\d{1,2}:\d{2}\b/g)) locks.add(match[0]);
  for (const match of text.matchAll(/\b\d+(?:[.,]\d+)?\s?(?:%|km|m|cm|mm|kg|g|ml|l|VND|đ|₫)\b/gi)) locks.add(match[0]);
  for (const match of text.matchAll(/\b\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?\b/g)) locks.add(match[0]);
  return [...locks];
}

export function makeBlocks({sourcePath, sourceSha='', recordPath, idField='id', recordId, fields, data}){
  const records = getAt(data, recordPath);
  if (!Array.isArray(records)) throw new Error(`record-path is not an array: ${recordPath}`);
  const index = records.findIndex(r => String(r?.[idField] ?? '') === String(recordId));
  if (index < 0) throw new Error(`Record not found: ${recordId}`);
  const record = records[index];
  return fields.map((field, i) => {
    const original = getAt(record, field);
    if (typeof original !== 'string') throw new Error(`Field is not a string: ${field}`);
    return {
      n:i+1,
      id:`${recordPath}.${recordId}.${field}`,
      sourcePath,
      sourceSha,
      pointer:`${recordPath}.${index}.${field}`,
      recordPath,
      recordId:String(recordId),
      field,
      hash:sha256(original),
      locks:inferLocks(original, record),
      original,
      rewrite:''
    };
  });
}

function safeMeta(value){
  return String(value ?? '').replace(/-->/g,'-- >').replace(/[\r\n]+/g,' ').trim();
}

export function renderPack(meta, blocks){
  const lines = [
    '# OPEN PHU QUOC - REWRITE PACK',
    '',
    '<!-- OPENPQ_REWRITE_PACK:1 -->',
    `<!-- SOURCE:${safeMeta(meta.sourcePath)} -->`,
    `<!-- SOURCE_SHA:${safeMeta(meta.sourceSha || '')} -->`,
    `<!-- RECORD_PATH:${safeMeta(meta.recordPath)} -->`,
    `<!-- RECORD_ID:${safeMeta(meta.recordId)} -->`,
    '',
    '> Chỉ điền nội dung giữa [REWRITE] và [/REWRITE]. Không sửa ID, ORIGINAL hoặc metadata.',
    '> Viết lại tiếng Việt tự nhiên, gọn, hữu ích. Không thêm fact mới. Giữ nguyên các dữ kiện bị khóa.',
    ''
  ];
  for (const b of blocks){
    lines.push(
      `## BLOCK ${String(b.n).padStart(3,'0')}`,
      `<!-- ID:${safeMeta(b.id)} -->`,
      `<!-- POINTER:${safeMeta(b.pointer)} -->`,
      `<!-- HASH:${b.hash} -->`,
      `<!-- LOCKS:${safeMeta(JSON.stringify(b.locks))} -->`,
      '[ORIGINAL]',
      b.original,
      '[/ORIGINAL]',
      '[REWRITE]',
      b.rewrite || '',
      '[/REWRITE]',
      ''
    );
  }
  return lines.join('\n');
}

export function parsePack(text){
  const pack = String(text ?? '');
  if (!pack.includes('<!-- OPENPQ_REWRITE_PACK:1 -->')) throw new Error('Not an OPENPQ rewrite pack v1');
  const blockRe = /## BLOCK\s+\d+[\s\S]*?<!-- ID:([^\n]*?) -->[\s\S]*?<!-- POINTER:([^\n]*?) -->[\s\S]*?<!-- HASH:([a-f0-9]{64}) -->[\s\S]*?<!-- LOCKS:([^\n]*?) -->[\s\S]*?\[ORIGINAL\]\n([\s\S]*?)\n\[\/ORIGINAL\][\s\S]*?\[REWRITE\]\n([\s\S]*?)\n\[\/REWRITE\]/g;
  const blocks=[];
  for (const m of pack.matchAll(blockRe)){
    let locks=[];
    try { locks = JSON.parse(m[4].trim()); } catch { throw new Error(`Invalid LOCKS for ${m[1].trim()}`); }
    blocks.push({id:m[1].trim(),pointer:m[2].trim(),hash:m[3],locks,original:m[5],rewrite:m[6].trim()});
  }
  if (!blocks.length) throw new Error('No rewrite blocks found');
  return blocks;
}

export function validateAndApply(data, blocks){
  const next = structuredClone(data);
  const report=[];
  for (const b of blocks){
    const current = getAt(next, b.pointer);
    if (typeof current !== 'string'){
      report.push({id:b.id,status:'error',reason:'pointer_missing'}); continue;
    }
    if (sha256(current) !== b.hash || current !== b.original){
      report.push({id:b.id,status:'error',reason:'source_changed'}); continue;
    }
    if (!b.rewrite){
      report.push({id:b.id,status:'skipped',reason:'empty_rewrite'}); continue;
    }
    const missing = (Array.isArray(b.locks)?b.locks:[]).filter(token => !b.rewrite.includes(token));
    if (missing.length){
      report.push({id:b.id,status:'error',reason:'lock_missing',missing}); continue;
    }
    if (/\u2013|\u2014/.test(b.rewrite)){
      report.push({id:b.id,status:'error',reason:'forbidden_dash'}); continue;
    }
    setAt(next, b.pointer, b.rewrite);
    report.push({id:b.id,status:'ready'});
  }
  return {data:next,report,ok:report.every(r=>r.status==='ready'||r.status==='skipped')};
}
