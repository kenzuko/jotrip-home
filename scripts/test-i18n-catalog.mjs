import assert from "node:assert/strict";
import {existsSync,readFileSync} from "node:fs";
import {join} from "node:path";
const root=process.env.OPENPQ_DIST||"dist";
const read=p=>JSON.parse(readFileSync(p,"utf8"));
const manifest=read(join(root,"data/i18n/locales.json"));
const catalog=read(join(root,"data/i18n/catalog.json"));
assert.equal(catalog.default_locale,manifest.default_locale);
assert.deepEqual(catalog.locales.map(x=>x.code),manifest.locales.map(x=>x.code));
assert.equal(catalog.locales.filter(x=>x.published).length,manifest.locales.filter(x=>x.published).length);
for(const kind of ["stories","knowledge","food"]){
  assert.ok(catalog.availability[kind]?.vi?.length>0,"Vietnamese "+kind+" availability must not be empty");
  for(const locale of catalog.locales){
    assert.ok(Array.isArray(catalog.availability[kind]?.[locale.code]),kind+" missing "+locale.code+" availability");
  }
}
for(const locale of catalog.locales.filter(x=>x.published&&x.code!=="vi")){
  assert.ok(existsSync(join(root,"data/i18n",locale.code,"ui.json")),"Published locale "+locale.code+" requires ui.json");
}
console.log("PASS i18n catalog:",catalog.locales.length,"locales,",catalog.locales.filter(x=>x.published).length,"published");
