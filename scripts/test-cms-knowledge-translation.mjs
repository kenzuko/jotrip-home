import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fields,hash,valid} from './translate-knowledge.mjs';
const objects=JSON.parse(readFileSync('data/views/knowledge-public.json','utf8')).objects;
for(const o of objects){
  assert(valid(o,fields(o)),o.topic_id);
  assert.notEqual(hash(o),hash({...o,title:o.title+' changed'}));
  assert(!valid(o,{...fields(o),images:[]} )||(o.media?.images||[]).length===0);
}
const runtime=readFileSync('guide/knowledge.js','utf8');
assert(runtime.includes("variant?.status!=='published'"));
assert(runtime.includes('variant.source_hash!==hash'));
console.log(`CMS knowledge translation contracts passed: ${objects.length} public articles`);
