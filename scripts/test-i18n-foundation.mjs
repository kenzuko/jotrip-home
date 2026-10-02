import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const manifest=JSON.parse(readFileSync("data/i18n/locales.json","utf8"));
assert.equal(manifest.default_locale,"vi");
assert.equal(manifest.url_strategy,"default-unprefixed");
const rows=manifest.locales||[];
assert.ok(rows.length>=2);
assert.equal(rows.filter(x=>x.published).length,1,"Only Vietnamese may be public while English is paused");
assert.equal(rows.find(x=>x.code==="vi")?.published,true);
assert.equal(rows.find(x=>x.code==="en")?.published,false);
assert.deepEqual(rows.find(x=>x.code==="en")?.surfaces,[]);
assert.equal(new Set(rows.map(x=>x.code)).size,rows.length);
assert.equal(new Set(rows.map(x=>x.url_code)).size,rows.length);
for(const row of rows){
  assert.match(row.code,/^[A-Za-z]{2,3}(?:-[A-Za-z]{4})?$/);
  assert.match(row.url_code,/^[a-z]{2,3}(?:-[a-z]+)?$/);
  assert.ok(row.html_lang&&row.native_name&&row.direction);
  assert.ok(Array.isArray(row.surfaces));
  if(row.code==="vi")assert.deepEqual(row.surfaces,["*"]);
  else assert.equal(row.surfaces.length,0,"Non-Vietnamese locales stay locked while public English is paused");
}
const server=await import("data:text/javascript;base64,"+Buffer.from(readFileSync("functions/_shared/i18n.js","utf8")).toString("base64"));
assert.equal(server.DEFAULT_LOCALE,"vi");
assert.deepEqual(server.LOCALES.map(x=>({code:x.code,url_code:x.urlCode,html_lang:x.htmlLang,published:x.published,surfaces:[...x.surfaces]})),
  rows.map(x=>({code:x.code,url_code:x.url_code,html_lang:x.html_lang,published:x.published,surfaces:x.surfaces})),
  "Worker locale registry must stay exactly synchronized with data/i18n/locales.json");
assert.equal(server.localizedPath("/stories/article.html","vi"),"/stories/article.html");
assert.equal(server.localizedPath("/stories/article.html","en"),"/en/stories/article.html");
assert.deepEqual(server.splitLocalePath("/en/stories/article.html").pathname,"/stories/article.html");
assert.equal(server.splitLocalePath("/en/stories/article.html").published,false);
assert.equal(server.splitLocalePath("/vi/stories/").defaultPrefixed,true);
assert.equal(server.splitLocalePath("/vi/stories/").pathname,"/stories/");
assert.equal(server.routeGroup("/stories/article.html"),"stories");
assert.equal(server.localeCanServe("vi","/weather/"),true);
assert.equal(server.localeCanServe("en","/stories/"),false);
assert.equal(server.localeCanServe("en","/weather/"),false);
assert.equal(server.localeCanServe("en","/airport/"),false);
assert.equal(server.localeFromLanguageTag("en-US")?.code,"en");
assert.equal(server.localeFromLanguageTag("zh-TW")?.code,"zh-Hant");
assert.equal(server.localeFromLanguageTag("zh-CN")?.code,"zh-Hans");
assert.equal(server.preferredPublishedLocale("en-US,en;q=0.9","/stories/"),"vi",
  "English browser must fall back to Vietnamese while English is paused");
assert.equal(server.preferredPublishedLocale("en-US,en;q=0.9","/weather/"),"vi",
  "English browser must fall back to Vietnamese while English is paused");
assert.equal(server.canonicalFor("/guide/article.html?id=x","vi"),"https://openphuquoc.com/guide/article.html?id=x");
assert.equal(server.canonicalFor("/guide/article.html?id=x","ko"),"https://openphuquoc.com/ko/guide/article.html?id=x");
assert.equal(server.alternateSet("/stories/article.html",["vi","en"]).at(-1).hreflang,"x-default");
const runtime=readFileSync("core/i18n-runtime.js","utf8");
assert.match(runtime,/OpenPQI18n/);
assert.match(runtime,/unpublished locales/i);
assert.match(runtime,/catalog\.json\?v=4/,"Locale catalog must be cache-busted after publication changes");
assert.match(runtime,/cache:"no-store"/,"Locale discovery must not rely on a stale browser cache");
const switcher=readFileSync("core/language-switcher.js","utf8");
assert.match(switcher,/searchParams\.set\("lang",code\)/,
  "Manual language choices must pass through the edge preference endpoint");
const worker=readFileSync("worker.js","utf8");
assert.match(worker,/accept-language/i);
assert.doesNotMatch(worker,/EN_PUBLIC_PAGES/,
  "English must not use a partial route whitelist");
assert.doesNotMatch(worker,/localizedTemplatePath/,
  "English must share the same public shells and runtimes as Vietnamese");
assert.match(worker,/localizedPageSupported/,
  "Worker must apply one public-shell locale policy");
const enRuntime=readFileSync("core/en-full-site.js","utf8");
assert.match(enRuntime,/MutationObserver/,
  "English presentation layer remains available for future review");
assert.match(enRuntime,/site-shell\.json/,
  "English presentation layer must keep the reviewed site-wide shell dictionary");
assert.ok(readFileSync("data/i18n/en/site-shell.json","utf8").includes('"locale": "en"'));
assert.match(switcher,/querySelector\("\.site-header, header\.top, header\.knowledge-header/,
  "Language selector runtime remains available but must not expose unpublished English");
assert.match(worker,/openpq_lang/);
const seoHtml=readFileSync("functions/_shared/seo-html.js","utf8");
assert.match(seoHtml,/i18n-runtime\.js\?v=4/);
assert.match(seoHtml,/language-switcher\.js\?v=4/);
assert.match(seoHtml,/data-openpq-language-switcher-server/);
assert.ok(seoHtml.includes("body > .opq-language-auto"));
assert.ok(seoHtml.includes('.on("body"'));
assert.match(switcher,/serverFallback/);
assert.match(worker,/private, no-store/);
console.log("PASS i18n foundation: Vietnamese-only publication lock with English paused");
