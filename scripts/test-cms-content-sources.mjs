import assert from "node:assert/strict";
import fs from "node:fs";
import {CMS_PATH_POLICY} from "../functions/_shared/cms-mutation-policy.js";

const registry=JSON.parse(fs.readFileSync("cms/content-sources.json","utf8"));
const schema=JSON.parse(fs.readFileSync("cms/schema.json","utf8"));

assert.equal(registry.version,"1.0");
assert.equal(registry.permission_source,"functions/_shared/cms-mutation-policy.js");
assert.ok(Array.isArray(registry.sources)&&registry.sources.length>0);

const allowedKinds=new Set(["canonical","internal_canonical","localized_source","generated","derived"]);
const byPath=new Map();
const ids=new Set();

for(const source of registry.sources){
  assert.ok(source.id&&typeof source.id==="string","Every source needs an id");
  assert.ok(!ids.has(source.id),"Duplicate source id: "+source.id);
  ids.add(source.id);

  assert.ok(source.path&&typeof source.path==="string","Every source needs a path: "+source.id);
  assert.ok(!byPath.has(source.path),"Duplicate source path: "+source.path);
  byPath.set(source.path,source);

  assert.ok(allowedKinds.has(source.kind),"Unknown source kind for "+source.path);
  assert.ok(source.owner&&typeof source.owner==="string","Missing owner for "+source.path);
  assert.ok(Array.isArray(source.module_ids),"module_ids must be an array for "+source.path);
  assert.equal(typeof source.editable_via_cms,"boolean","editable_via_cms must be boolean for "+source.path);
  assert.equal(typeof source.public_bundle,"boolean","public_bundle must be boolean for "+source.path);
  assert.ok(Array.isArray(source.derived_from),"derived_from must be an array for "+source.path);
  assert.ok(Array.isArray(source.generated_by),"generated_by must be an array for "+source.path);
  assert.ok(Array.isArray(source.build_dependencies),"build_dependencies must be an array for "+source.path);
  assert.ok(Array.isArray(source.derived_outputs),"derived_outputs must be an array for "+source.path);

  for(const forbidden of ["roles","read","write","permissions"]){
    assert.equal(Object.hasOwn(source,forbidden),false,
      "Registry must not duplicate permission policy field "+forbidden+" on "+source.path);
  }

  if(source.editable_via_cms){
    assert.ok(Object.hasOwn(CMS_PATH_POLICY,source.path),
      "Editable source missing mutation policy: "+source.path);
  }

  if(source.kind==="generated"||source.kind==="derived"){
    assert.equal(source.editable_via_cms,false,
      "Generated/derived output must not be directly editable: "+source.path);
    assert.ok(source.generated_by.length>0,
      "Generated/derived output needs a generator: "+source.path);
    assert.ok(source.derived_from.length>0,
      "Generated/derived output needs source provenance: "+source.path);
  }

  for(const generator of source.generated_by){
    assert.ok(fs.existsSync(generator),"Missing generator "+generator+" for "+source.path);
  }

  if(!source.path.includes("*")){
    assert.ok(fs.existsSync(source.path),"Registered source path does not exist: "+source.path);
  }
}

for(const module of schema.modules.filter(x=>x.path)){
  const source=byPath.get(module.path);
  assert.ok(source,"Schema module path missing from content source registry: "+module.path);
  assert.ok(source.module_ids.includes(module.id),
    "Registry source "+module.path+" must reference module "+module.id);
}

for(const policyPath of Object.keys(CMS_PATH_POLICY)){
  const source=byPath.get(policyPath);
  assert.ok(source,"Mutation-policy path missing from content source registry: "+policyPath);
  assert.equal(source.editable_via_cms,true,
    "Mutation-policy path must be marked editable_via_cms: "+policyPath);
}

const knowledge=byPath.get("data/knowledge/objects.json");
assert.equal(knowledge.kind,"internal_canonical");
assert.equal(knowledge.public_bundle,false);
assert.ok(knowledge.derived_outputs.includes("data/views/knowledge-public.json"));
assert.ok(knowledge.derived_outputs.includes("data/views/knowledge-home.json"));

for(const outputPath of ["data/views/knowledge-public.json","data/views/knowledge-home.json"]){
  const output=byPath.get(outputPath);
  assert.ok(output);
  assert.equal(output.editable_via_cms,false);
  assert.ok(output.derived_from.includes("data/knowledge/objects.json"));
  assert.ok(output.derived_from.includes("data/visual-context.json"));
  assert.ok(output.generated_by.includes("scripts/build-knowledge-public.mjs"));
  assert.equal(Object.hasOwn(CMS_PATH_POLICY,outputPath),false,
    "Generated output must not become a CMS mutation path");
}

const viFood=byPath.get("data/i18n/vi/food.json");
assert.equal(viFood.kind,"localized_source");
assert.equal(viFood.locale,"vi");
assert.equal(viFood.translation_family,"food");
assert.equal(viFood.source_locale,true);

const users=byPath.get("cms/users.json");
assert.equal(users.public_bundle,false);

console.log("CMS content source registry PASS:",registry.sources.length,
  "sources; schema and mutation-policy coverage complete.");
