import assert from "node:assert/strict";
import fs from "node:fs";
import {execFileSync} from "node:child_process";

const lifecycle=JSON.parse(fs.readFileSync("cms/translation-lifecycle.json","utf8"));
const registry=JSON.parse(fs.readFileSync("cms/content-sources.json","utf8"));

const EXPECTED_LOCALES=["en","ko","ru","lo","zh-Hans","zh-Hant","fr"];
const VALID_STATUSES=new Set(["missing","machine_draft","human_review","published","stale"]);
const sourceById=new Map(registry.sources.map(source=>[source.id,source]));

assert.equal(lifecycle.version,"1.0");
assert.equal(lifecycle.source_locale,"vi");
assert.equal(lifecycle.source_revision_strategy,"git_blob_sha1");
assert.deepEqual(lifecycle.target_locales.map(x=>x.code),EXPECTED_LOCALES);
assert.deepEqual(Object.keys(lifecycle.statuses).sort(),[...VALID_STATUSES].sort());

const familyIds=new Set();
for(const family of lifecycle.families){
  assert.ok(family.id&&!familyIds.has(family.id),"Duplicate or missing translation family id: "+family.id);
  familyIds.add(family.id);

  const source=sourceById.get(family.source_id);
  assert.ok(source,"Translation family source_id is not registered: "+family.source_id);
  assert.equal(source.path,family.source_path,"Translation source path must match content source registry");
  assert.equal(source.translation_family,family.id,
    "Translation family must match content source registry for "+family.source_path);
  assert.equal(source.locale,lifecycle.source_locale,
    "Translation source locale must be Vietnamese for "+family.source_path);
  assert.equal(source.source_locale,true,
    "Translation family source must be marked as source_locale in content source registry");
  assert.ok(fs.existsSync(family.source_path),"Missing translation source: "+family.source_path);

  const currentBlob=execFileSync("git",["hash-object",family.source_path],{encoding:"utf8"}).trim();
  assert.match(currentBlob,/^[a-f0-9]{40}$/);

  assert.deepEqual(Object.keys(family.targets),EXPECTED_LOCALES,
    "Translation targets must follow the declared locale order for "+family.id);

  for(const locale of EXPECTED_LOCALES){
    const target=family.targets[locale];
    assert.ok(target&&VALID_STATUSES.has(target.status),
      "Invalid translation status for "+family.id+"/"+locale);

    const hasTarget=typeof target.target_path==="string"&&target.target_path.length>0;
    const hasRevision=typeof target.translated_from_blob_sha==="string"&&
      /^[a-f0-9]{40}$/.test(target.translated_from_blob_sha);

    if(target.status==="missing"){
      assert.equal(target.target_path,null,"Missing translation must not invent a target file");
      assert.equal(target.translated_from_blob_sha,null,
        "Missing translation must not invent a source revision");
      assert.equal(target.reviewed_by,null);
      assert.equal(target.reviewed_at,null);
      assert.equal(target.published_at,null);
      continue;
    }

    assert.equal(hasTarget,true,"Existing translation state requires target_path: "+family.id+"/"+locale);
    assert.ok(fs.existsSync(target.target_path),
      "Lifecycle target file does not exist: "+target.target_path);
    assert.equal(hasRevision,true,
      "Existing translation state requires translated_from_blob_sha: "+family.id+"/"+locale);

    if(family.target_path_pattern){
      const expected=family.target_path_pattern.replace("{locale}",locale);
      assert.equal(target.target_path,expected,
        "Target path does not match family pattern for "+family.id+"/"+locale);
    }

    if(target.status==="stale"){
      assert.notEqual(target.translated_from_blob_sha,currentBlob,
        "stale requires a source revision older/different from current source: "+family.id+"/"+locale);
      continue;
    }

    assert.equal(target.translated_from_blob_sha,currentBlob,
      target.status+" translation must match current Vietnamese source revision: "+family.id+"/"+locale);

    if(target.status==="machine_draft"){
      assert.equal(target.reviewed_by,null);
      assert.equal(target.reviewed_at,null);
      assert.equal(target.published_at,null);
    }

    if(target.status==="human_review"){
      assert.ok(target.reviewed_by&&target.reviewed_at,
        "human_review requires reviewer metadata: "+family.id+"/"+locale);
      assert.equal(target.published_at,null);
    }

    if(target.status==="published"){
      assert.ok(target.reviewed_by&&target.reviewed_at,
        "published requires human review metadata: "+family.id+"/"+locale);
      assert.ok(target.published_at,
        "published requires published_at: "+family.id+"/"+locale);
    }
  }
}

assert.ok(familyIds.has("food"));
assert.ok(familyIds.has("knowledge"));

const serialized=JSON.stringify(lifecycle);
assert.equal(/cms\.openphuquoc\.com/.test(serialized),false,
  "Translation lifecycle must not encode the old CMS public-origin architecture");
assert.equal(/openphuquoc-v3/.test(serialized),false,
  "Translation metadata must stay independent of deployment routing");

console.log("CMS translation lifecycle PASS:",lifecycle.families.length,
  "families x",EXPECTED_LOCALES.length,"target locales; no bulk translation created.");
