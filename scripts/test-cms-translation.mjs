import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {languages,sourceHash,validateTranslation} from './translate-stories.mjs';
const stories=JSON.parse(readFileSync('data/content.json','utf8')).stories;
assert.equal(Object.keys(languages).length,7);
assert.equal(new Set(stories.map(s=>s.id)).size,stories.length);
for(const story of stories){
  const fields={title:story.title,category:story.category,dek:story.dek,intro:story.intro,image_alt:story.image_alt,image_caption:story.image_caption,sections:story.sections};
  assert.deepEqual(validateTranslation(story,fields),[]);
  assert.notEqual(sourceHash(story),sourceHash({...story,title:story.title+' edited'}));
  assert(validateTranslation(story,{...fields,sections:[]}).includes('sections count'));
}
const runtime=readFileSync('stories/story.js','utf8');
assert(runtime.includes('variant.source_hash!==await sourceHash(story)'));
assert(runtime.includes('variant?.status!=="published"'));
assert(runtime.includes('Không tìm thấy bài viết'));
console.log(`CMS translation contracts passed: ${stories.length} stories, seven target locales, stale and unreviewed variants blocked`);
