import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const manifest=JSON.parse(readFileSync("data/i18n/locales.json","utf8"));
assert.equal(manifest.default_locale,"vi");
assert.equal(manifest.url_strategy,"default-unprefixed");
const rows=manifest.locales||[];
assert.ok(rows.length>=2);
assert.equal(rows.filter(x=>x.published).length,1,"Only Vietnamese may be public before translations are reviewed");
assert.equal(rows.find(x=>x.code==="vi")?.published,true);
assert.equal(new Set(rows.map(x=>x.code)).size,rows.length);
assert.equal(new Set(rows.map(x=>x.url_code)).size,rows.length);
for(const row of rows){
  assert.match(row.code,/^[A-Za-z]{2,3}(?:-[A-Za-z]{4})?$/);
  assert.match(row.url_code,/^[a-z]{2,3}(?:-[a-z]+)?$/);
  assert.ok(row.html_lang&&row.native_name&&row.direction);
}
const server=await import("data:text/javascript;base64,"+Buffer.from(readFileSync("functions/_shared/i18n.js","utf8")).toString("base64"));
assert.equal(server.DEFAULT_LOCALE,"vi");
assert.equal(server.localizedPath("/stories/article.html","vi"),"/stories/article.html");
assert.equal(server.localizedPath("/stories/article.html","en"),"/en/stories/article.html");
assert.deepEqual(server.splitLocalePath("/en/stories/article.html").pathname,"/stories/article.html");
assert.equal(server.splitLocalePath("/en/stories/article.html").published,false);
assert.equal(server.canonicalFor("/guide/article.html?id=x","vi"),"https://openphuquoc.com/guide/article.html?id=x");
assert.equal(server.canonicalFor("/guide/article.html?id=x","ko"),"https://openphuquoc.com/ko/guide/article.html?id=x");
assert.equal(server.alternateSet("/stories/article.html",["vi","en"]).at(-1).hreflang,"x-default");
const runtime=readFileSync("core/i18n-runtime.js","utf8");
assert.match(runtime,/OpenPQI18n/);
assert.match(runtime,/unpublished locales/i);
console.log("PASS i18n foundation: locale registry, URL policy, canonical paths and publication lock");
