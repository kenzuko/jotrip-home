import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const manifest=JSON.parse(readFileSync("data/i18n/locales.json","utf8"));
assert.equal(manifest.default_locale,"vi");
assert.equal(manifest.url_strategy,"default-unprefixed");
const rows=manifest.locales||[];
assert.ok(rows.length>=2);
assert.equal(rows.filter(x=>x.published).length,2,"Vietnamese and reviewed English should be public");
assert.equal(rows.find(x=>x.code==="vi")?.published,true);
assert.equal(new Set(rows.map(x=>x.code)).size,rows.length);
assert.equal(new Set(rows.map(x=>x.url_code)).size,rows.length);
for(const row of rows){
  assert.match(row.code,/^[A-Za-z]{2,3}(?:-[A-Za-z]{4})?$/);
  assert.match(row.url_code,/^[a-z]{2,3}(?:-[a-z]+)?$/);
  assert.ok(row.html_lang&&row.native_name&&row.direction);
  assert.ok(Array.isArray(row.surfaces));
  if(row.code==="vi")assert.deepEqual(row.surfaces,["*"]);
  else if(row.code==="en")assert.deepEqual(row.surfaces,["home","stories","guide","food","airport"]);
  else assert.equal(row.surfaces.length,0);
}
const server=await import("data:text/javascript;base64,"+Buffer.from(readFileSync("functions/_shared/i18n.js","utf8")).toString("base64"));
assert.equal(server.DEFAULT_LOCALE,"vi");
assert.deepEqual(server.LOCALES.map(x=>({code:x.code,url_code:x.urlCode,html_lang:x.htmlLang,published:x.published,surfaces:[...x.surfaces]})),
  rows.map(x=>({code:x.code,url_code:x.url_code,html_lang:x.html_lang,published:x.published,surfaces:x.surfaces})),
  "Worker locale registry must stay exactly synchronized with data/i18n/locales.json");
assert.equal(server.localizedPath("/stories/article.html","vi"),"/stories/article.html");
assert.equal(server.localizedPath("/stories/article.html","en"),"/en/stories/article.html");
assert.deepEqual(server.splitLocalePath("/en/stories/article.html").pathname,"/stories/article.html");
assert.equal(server.splitLocalePath("/en/stories/article.html").published,true);
assert.equal(server.splitLocalePath("/vi/stories/").defaultPrefixed,true);
assert.equal(server.splitLocalePath("/vi/stories/").pathname,"/stories/");
assert.equal(server.routeGroup("/stories/article.html"),"stories");
assert.equal(server.localeCanServe("vi","/weather/"),true);
assert.equal(server.localeCanServe("en","/stories/"),true);
assert.equal(server.localeCanServe("en","/weather/"),false);
assert.equal(server.localeCanServe("en","/airport/"),true);
assert.equal(server.localeFromLanguageTag("en-US")?.code,"en");
assert.equal(server.localeFromLanguageTag("zh-TW")?.code,"zh-Hant");
assert.equal(server.localeFromLanguageTag("zh-CN")?.code,"zh-Hans");
assert.equal(server.preferredPublishedLocale("en-US,en;q=0.9","/stories/"),"en",
  "Reviewed English should be selected for an English browser on a published surface");
assert.equal(server.preferredPublishedLocale("en-US,en;q=0.9","/weather/"),"vi",
  "English must fall back to Vietnamese on an unpublished surface");
assert.equal(server.canonicalFor("/guide/article.html?id=x","vi"),"https://openphuquoc.com/guide/article.html?id=x");
assert.equal(server.canonicalFor("/guide/article.html?id=x","ko"),"https://openphuquoc.com/ko/guide/article.html?id=x");
assert.equal(server.alternateSet("/stories/article.html",["vi","en"]).at(-1).hreflang,"x-default");
const runtime=readFileSync("core/i18n-runtime.js","utf8");
assert.match(runtime,/OpenPQI18n/);
assert.match(runtime,/unpublished locales/i);
const switcher=readFileSync("core/language-switcher.js","utf8");
assert.match(switcher,/searchParams\.set\("lang",code\)/,
  "Manual language choices must pass through the edge preference endpoint");
const worker=readFileSync("worker.js","utf8");
assert.match(worker,/accept-language/i);
assert.match(worker,/openpq_lang/);
assert.match(worker,/private, no-store/);
console.log("PASS i18n foundation: locale registry, URL policy, canonical paths and publication lock");
