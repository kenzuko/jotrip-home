import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {join} from "node:path";

const root=process.env.OPENPQ_DIST||"dist";
const readJson=p=>JSON.parse(readFileSync(join(root,p),"utf8"));
const routes=readJson("data/i18n/routes.json");
const locales=readJson("data/i18n/locales.json");
const published=(locales.locales||[]).filter(x=>x.published).map(x=>x.code);
assert.deepEqual(published,["vi","en"],"Only reviewed VI/EN may be exposed by the current static selector");

for(const route of routes.static_shells||[]){
  const path=join(root,route.file);
  assert.ok(existsSync(path),"Missing route file: "+route.file);
  const html=readFileSync(path,"utf8");
  if(route.selector==="native"){
    assert.match(html,/id=["']languageSelect["']/,"Native selector route must keep its own language control: "+route.path);
    assert.doesNotMatch(html,/data-openpq-language-static/,"Native selector route must not receive a second selector: "+route.path);
    continue;
  }
  assert.equal((html.match(/data-openpq-language-static/g)||[]).length,1,"Exactly one static selector required: "+route.path);
  assert.equal((html.match(/id="openpq-static-language-bootstrap"/g)||[]).length,route.autodetect?1:0,"Unexpected bootstrap count: "+route.path);
  assert.match(html,/data-openpq-lang="vi"/,"VI selector link missing: "+route.path);
  assert.match(html,/data-openpq-lang="en"/,"EN selector link missing: "+route.path);
  assert.doesNotMatch(html,/data-openpq-lang="(?:ko|ru|lo|fr|zh)/,"Unpublished locale leaked into selector: "+route.path);
  assert.match(html,/hreflang="x-default"/,"x-default alternate missing: "+route.path);
  assert.doesNotMatch(html,/catalog\.json/,"Static selector/bootstrap must not depend on the locale catalog at runtime: "+route.path);
}

for(const route of routes.entity_shells||[]){
  const path=join(root,route.file);
  assert.ok(existsSync(path),"Missing entity shell: "+route.file);
  const html=readFileSync(path,"utf8");
  assert.doesNotMatch(html,/data-openpq-language-static/,"Entity selector must remain availability-aware at the edge: "+route.path);
}

const catalog=readJson("data/i18n/catalog.json");
const food=catalog.coverage?.en?.food;
assert.ok(food&&food.total>0,"English food coverage missing");
assert.equal(food.translated,food.total,"Food article static VI/EN selector is allowed only while EN food coverage is complete");

const wrangler=readFileSync("wrangler.jsonc","utf8");
for(const forbidden of ['"/"','"/index.html"','"/weather/"','"/transit/"','"/food/"','"/stories/"','"/guide/"','"/nearme/"','"/go/"']){
  assert.equal(wrangler.includes(forbidden),false,"Language work must not move static VI route into Worker-first: "+forbidden);
}
console.log("PASS static language shell: full static route manifest, no duplicate Airport selector, no VI Worker regression");
