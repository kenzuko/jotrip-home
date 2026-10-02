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
  assert.match(html,/const syncLinks=/,"Static selector must hydrate canonical hrefs with the current query/hash: "+route.path);
  if(route.query_sensitive){
    assert.match(html,/href="#language-vi"[^>]*data-openpq-target="\/food\/article\.html"/,"Query-sensitive VI selector must fail closed without JS: "+route.path);
    assert.match(html,/href="#language-en"[^>]*data-openpq-target="\/en\/food\/article\.html"/,"Query-sensitive EN selector must carry its canonical route separately: "+route.path);
    assert.match(html,/a\.getAttribute\("data-openpq-target"\)\|\|a\.getAttribute\("href"\)/,"Query-sensitive selector hydration must preserve current query through bootstrap: "+route.path);
  }else assert.doesNotMatch(html,/data-openpq-target=/,"Only query-sensitive shells need indirect language targets: "+route.path);
  if(route.alternates===false)assert.doesNotMatch(html,/hreflang="x-default"/,"Query-sensitive shell must not publish incomplete static alternates: "+route.path);
  else assert.match(html,/hreflang="x-default"/,"x-default alternate missing: "+route.path);
  assert.doesNotMatch(html,/catalog\.json/,"Static selector/bootstrap must not depend on the locale catalog at runtime: "+route.path);
  assert.match(html,/\.opq-language-auto\{display:none!important\}/,"Legacy Worker selector must be hidden when static shell owns language UI: "+route.path);
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

const enRuntime=readFileSync(join(root,"core/en-full-site.js"),"utf8");
assert.match(enRuntime,/data-openpq-lang/,
  "English link localizer must preserve static language selector targets");
assert.match(enRuntime,/data-openpq-language-static/,
  "English link localizer must ignore the whole static selector island");

const wrangler=readFileSync("wrangler.jsonc","utf8");
for(const forbidden of ['"/"','"/index.html"','"/weather/"','"/transit/"','"/food/"','"/stories/"','"/guide/"','"/nearme/"','"/go/"']){
  assert.equal(wrangler.includes(forbidden),false,"Language work must not move static VI route into Worker-first: "+forbidden);
}
console.log("PASS static language shell: route manifest, hydrated query-safe links, EN compatibility, no duplicate Airport selector, no VI Worker regression");
