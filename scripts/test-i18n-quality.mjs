import assert from "node:assert/strict";
import {loadGlossary,protectForTranslation,qualityProblems,repairScopeIncludes,restoreAfterTranslation,scanRejected} from "./i18n-quality.mjs";

const glossary=loadGlossary();
assert.ok(Array.isArray(glossary.terms)&&glossary.terms.length>=20,"translation glossary should contain the core Phu Quoc terms");
const ids=glossary.terms.map(x=>x.id);
assert.equal(ids.length,new Set(ids).size,"translation glossary contains duplicate ids");

for(const rule of glossary.terms){
  assert.ok(rule.id&&rule.canonical,"glossary term requires id and canonical form");
  assert.ok(rule.forms?.vi?.length||rule.forms?.en?.length,"glossary term requires at least one source form");
  for(const [locale,value] of Object.entries(rule.targets||{}))assert.ok(String(value).trim(),rule.id+" has empty target for "+locale);
}

const protectedZh=protectForTranslation("Bún quậy dùng tắc/quất ở Phú Quốc lúc 10:30.",{
  fromLocale:"vi",targetLocale:"zh-Hans",familyId:"food",glossary
});
assert.match(protectedZh.text,/OPENPQTERM/);
assert.match(protectedZh.text,/OPENPQTOKEN/);
assert.doesNotMatch(protectedZh.text,/Bún quậy/);
assert.doesNotMatch(protectedZh.text,/tắc\/quất/);
const restoredZh=restoreAfterTranslation(protectedZh.text,protectedZh);
assert.match(restoredZh,/Bún quậy/);
assert.match(restoredZh,/卡拉曼橘/);
assert.match(restoredZh,/富国岛/);
assert.match(restoredZh,/10:30/);

const protectedKo=protectForTranslation("Nhum nướng mỡ hành",{
  fromLocale:"vi",targetLocale:"ko",familyId:"food",glossary
});
const restoredKo=restoreAfterTranslation(protectedKo.text,protectedKo);
assert.match(restoredKo,/성게/);
assert.match(restoredKo,/파기름/);

assert.ok(qualityProblems("Bún quậy","邦码头",{fromLocale:"vi",targetLocale:"zh-Hans",familyId:"food",glossary}).length);
assert.equal(qualityProblems("Bún quậy","Bún quậy（富国现压米粉汤）",{fromLocale:"vi",targetLocale:"zh-Hans",familyId:"food",glossary}).length,0);
assert.ok(scanRejected("en","The road network underwent orthopedic surgery.",{glossary}).length);
assert.ok(repairScopeIncludes("core","stories",{recordPath:["sections",0,"body"]}));
assert.ok(repairScopeIncludes("core","knowledge",{recordPath:["editorial","short_summary"]}));
assert.equal(repairScopeIncludes("core","knowledge",{recordPath:["editorial","before_you_go",0]}),false);

console.log("PASS i18n quality: glossary protection, marker restoration, rejected literals and repair scopes");
