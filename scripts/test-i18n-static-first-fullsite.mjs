import assert from "node:assert/strict";
import {readFile,readdir} from "node:fs/promises";
import {join,relative,sep} from "node:path";
import {LOCALES,DEFAULT_LOCALE,publishedLocales,localeCanServe} from "../functions/_shared/i18n.js";

const root=process.argv[2]||"dist-i18n-test";
const report=JSON.parse(await readFile(join(root,"_test/i18n-static-first-report.json"),"utf8"));
const registry=JSON.parse(await readFile("data/i18n/locales.json","utf8"));
const registryPublished=(registry.locales||[]).filter(x=>x.published).map(x=>x.code).sort();
const runtimePublished=publishedLocales().map(x=>x.code).sort();
assert.deepEqual(runtimePublished,registryPublished,"Build registry and Worker registry must agree before release");
assert.equal(DEFAULT_LOCALE,registry.default_locale,"Default locale must have one meaning");
assert.deepEqual(registryPublished,["en","vi"],"Only reviewed VI/EN may be published in this release");
for(const row of LOCALES)assert.equal(Boolean(row.published),Boolean((registry.locales||[]).find(x=>x.code===row.code)?.published),`published mismatch: ${row.code}`);

assert.ok(report.pages.length>=20,`Expected broad public HTML coverage, got ${report.pages.length}`);
const seen=new Set();
for(const page of report.pages){
  assert.ok(!seen.has(page.rel),`Duplicate public page in report: ${page.rel}`);seen.add(page.rel);
  assert.ok(!page.rel.startsWith("admin/")&&!page.rel.startsWith("cms/"),`Private page leaked into selector bundle: ${page.rel}`);
  assert.deepEqual([...page.published].sort(),registryPublished,`Published locale mismatch on ${page.rel}`);
  assert.equal(localeCanServe("en",page.route),true,`Current EN publication policy must be able to serve ${page.route}`);
  assert.equal(page.en,page.route==="/"?"/en/":"/en"+page.route,`EN counterpart mismatch on ${page.rel}`);
  const html=await readFile(join(root,page.rel),"utf8");
  assert.equal((html.match(/\/core\/locale-router-static\.js/g)||[]).length,1,`${page.rel} must load locale router once`);
  assert.equal((html.match(/\/core\/locale-router-static\.css/g)||[]).length,1,`${page.rel} must load selector CSS once`);
  if(page.selector==="native"){
    assert.match(html,/id=["']languageSelect["']/,`${page.rel} native selector marker missing`);
    assert.equal((html.match(/data-openpq-static-language/g)||[]).length,0,`${page.rel} must not get a duplicate shared selector`);
  }else{
    assert.equal((html.match(/data-openpq-static-language/g)||[]).length,1,`${page.rel} must contain exactly one static selector`);
    assert.match(html,/href=["']\/en(?:\/|[^"']*)["']/,`${page.rel} must expose an EN route at first paint`);
  }
}

for(const required of ["index.html","weather/index.html","transit/index.html","guide/index.html","stories/index.html","food/index.html","go/index.html","nearme/index.html","explore/index.html","about/index.html"])
  assert.ok(seen.has(required),`Public route family missing from test matrix: ${required}`);
assert.ok(report.pages.some(x=>x.rel==="airport/index.html"&&x.selector==="native"),"Airport must keep its native selector ownership");

const router=await readFile("core/locale-router-static.js","utf8");
assert.doesNotMatch(router,/fetch\s*\(/,"Selector/router must never fetch locale catalogs");
assert.doesNotMatch(router,/createElement\s*\(/,"Router must never invent selector DOM");
assert.doesNotMatch(router,/OpenPQI18n/,"Selector must not depend on legacy i18n runtime");
assert.match(router,/searchParams\.append/,"Router must preserve non-language query parameters");
assert.match(router,/url\.hash=hash/,"Router must preserve URL fragments");
assert.match(router,/document\.cookie=.*openpq_lang/,"Manual choice must persist locally without a Worker redirect");

const wrangler=await readFile("wrangler.jsonc","utf8");
for(const forbidden of ["/weather/*","/guide/*","/airport/*","/transit/*","/food/*","/go/*","/nearme/*","/explore/*"])
  assert.ok(!wrangler.includes(`\"${forbidden}\"`),`Regression: broad VI Worker-first route returned: ${forbidden}`);

console.log(`PASS static-first full-site contract: ${report.pages.length} public HTML pages, VI/EN registry parity, one selector owner per page, canonical EN counterparts, no catalog fetch, no broad VI Worker-first routes`);
