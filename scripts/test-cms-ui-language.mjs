import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {chunks} from './translate-ui.mjs';
const source=JSON.parse(execFileSync('python3',['scripts/extract-cms-ui.py'],{encoding:'utf8'}));
assert(Object.keys(source.pages).length>=29);
assert(source.pages['/'].length>10);
assert(source.pages['/stories/'].length>5);
assert(source.pages['/guide/article.html'].length>5);
assert.deepEqual(chunks([1,2,3],2),[[1,2],[3]]);
for(const route of Object.keys(source.pages)){
  const file=route.endsWith('/')?route+'index.html':route;
  assert(readFileSync('.'+file,'utf8').includes('core/site-language.js'),route);
}
const runtime=readFileSync('core/site-language.js','utf8');
assert(runtime.includes("catalog.status!=='published'"));
assert(runtime.includes("localStorage.setItem('openpq-language'"));
assert(runtime.includes("location.pathname.startsWith('/airport/')"));
console.log(`CMS language shell passed: ${Object.keys(source.pages).length} public pages`);
