import fs from 'node:fs';
import assert from 'node:assert/strict';
const json=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const catalog=json('data/photo-library.json');
const visual=json('data/visual-context.json');
const hotels=json('data/entities/hotels.json').entities;
const html=fs.readFileSync('index.html','utf8');
assert.equal(catalog.version,'2026-09-26.3');
assert.ok(catalog.items.every(x=>!/^shutterstock_/i.test(x.original_filename)), 'No Shutterstock in published catalog');
for(const item of catalog.items){
  if(!item.path?.startsWith('/assets/'))continue;
  assert.ok(fs.existsSync(item.path.slice(1)), 'Missing catalog photo '+item.path);
}
assert.ok(html.includes('/assets/media/editorial-tropical-beach.jpg'));
assert.ok(html.includes('/assets/media/editorial-ho-quoc-detail.jpg'));
assert.ok(!html.includes('<img loading="lazy" src="/assets/photos/starfish-beach-jo-library.jpg"'),'No starfish-on-sand promotion');
assert.match(visual.places.place_grand_world.images[0].url,/editorial-grand-world-day/);
assert.equal(visual.places.activity_tour_3_islands.images[0].source_label,'JoTrip','Preserve actual JoTrip tour image as lead');
assert.equal(visual.knowledge['knowledge_124_cano-3-dao'].images[0].scope,'context','Unverified island location must be marked context');
for(const slug of ['regent','salinda-resort']){
 const h=hotels.find(x=>x.slug===slug);
 assert.ok(h?.editorial_photo?.url?.startsWith('/assets/media/'),'Hotel photo with matching slug '+slug);
 assert.ok(fs.existsSync(h.editorial_photo.url.slice(1)),'Hotel image present '+slug);
 assert.equal(h.editorial_photo.source_verified,false,'Do not claim unverified ownership or license');
}
console.log('Editorial image QA passed: no Shutterstock, matching subjects, local assets, source caveats, and intact JoTrip tour lead.');
