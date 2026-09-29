import assert from "node:assert/strict";
import fs from "node:fs";
import {CMS_PATH_POLICY,cmsPathsFor} from "../functions/_shared/cms-mutation-policy.js";

const schema=JSON.parse(fs.readFileSync("cms/schema.json","utf8"));
const registry=JSON.parse(fs.readFileSync("cms/content-sources.json","utf8"));
const lifecycle=JSON.parse(fs.readFileSync("cms/translation-lifecycle.json","utf8"));

const sourceById=new Map(registry.sources.map(source=>[source.id,source]));
const familyById=new Map(lifecycle.families.map(family=>[family.id,family]));
const modulesById=new Map(schema.modules.map(module=>[module.id,module]));
const ROLE_KEYS=["read","preflight","draft","publish","direct_save","rollback"];
const POLICY_KEY={read:"read",preflight:"preflight",draft:"draft",publish:"publish",direct_save:"directSave",rollback:"rollback"};

const legacy={
  home:{path:"data/home-copy.json",preview:"../",read:["admin","editor","operator","viewer"],write:["admin","editor"]},
  stories:{path:"data/content.json",preview:"../stories/",read:["admin","editor","operator","viewer"],write:["admin","editor"]},
  guide:{path:"guide/data.json",preview:"../guide/",read:["admin","editor","operator","viewer"],write:["admin","editor"]},
  utilities:{path:"data/utilities.json",preview:"../utilities/",read:["admin","editor","operator","viewer"],write:["admin","operator"]},
  venues:{path:"data/entities/destination-venues.json",preview:"../nearme/",read:["admin","editor","operator","viewer"],write:["admin","editor","operator"]},
  foods:{path:"data/entities/food.json",preview:null,read:["admin","editor","operator","viewer"],write:["admin","editor"]},
  visuals:{path:"data/visual-context.json",preview:"../guide/knowledge.html",read:["admin","editor","viewer"],write:["admin","editor"]},
  users:{path:"cms/users.json",preview:null,read:["admin"],write:["admin"]},
  analytics:{path:null,preview:null,read:["admin"],write:[]},
  traffic:{path:null,preview:null,read:["admin"],write:[]}
};

assert.equal(schema.version,"2.0");
assert.equal(schema.compatibility?.legacy_admin_runtime,true);
assert.equal(schema.compatibility?.migration_mode,"additive");
assert.equal(schema.contracts?.content_sources,"cms/content-sources.json");
assert.equal(schema.contracts?.translation_lifecycle,"cms/translation-lifecycle.json");
assert.equal(schema.contracts?.mutation_policy,"functions/_shared/cms-mutation-policy.js");
assert.equal(schema.contracts?.public_preview_origin,"public_canonical");
assert.ok(Array.isArray(schema.field_types)&&schema.field_types.includes("structured_json"));

assert.deepEqual(schema.modules.map(m=>m.id),Object.keys(legacy),
  "Schema V2 must not add/reorder visible modules during metadata-only migration");

for(const module of schema.modules){
  const prior=legacy[module.id];
  assert.ok(prior,"Unexpected module: "+module.id);

  for(const key of ["id","label","description","path","preview","read","write"]){
    assert.ok(Object.hasOwn(module,key),"Legacy key missing from "+module.id+": "+key);
  }
  assert.equal(module.path,prior.path,"Legacy path changed for "+module.id);
  assert.equal(module.preview,prior.preview,"Legacy preview changed for "+module.id);
  assert.deepEqual(module.read,prior.read,"Legacy read roles changed for "+module.id);
  assert.deepEqual(module.write,prior.write,"Legacy write roles changed for "+module.id);

  assert.ok(module.audit_category&&typeof module.audit_category==="string",
    "Missing audit category for "+module.id);
  assert.ok(module.translation&&typeof module.translation.aware==="boolean",
    "Missing translation contract for "+module.id);
  assert.ok(module.mutation&&typeof module.mutation.direct_save_allowed==="boolean",
    "Missing mutation contract for "+module.id);
  assert.ok(Array.isArray(module.editable_fields),"editable_fields must be an array for "+module.id);

  if(module.preview_route!==null){
    assert.match(module.preview_route,/^\//,"preview_route must be a public-root path for "+module.id);
    assert.equal(/^https?:\/\//i.test(module.preview_route),false,
      "preview_route must not encode an origin for "+module.id);
  }

  if(module.path){
    const source=sourceById.get(module.canonical_source);
    assert.ok(source,"Unknown canonical source id for "+module.id+": "+module.canonical_source);
    assert.equal(source.path,module.path,"Canonical source path mismatch for "+module.id);
    assert.ok(source.module_ids.includes(module.id),
      "Canonical source must reference module "+module.id);

    const policy=CMS_PATH_POLICY[module.path];
    assert.ok(policy,"Module path missing mutation policy: "+module.path);
    for(const key of ROLE_KEYS){
      assert.deepEqual(module.permissions[key],policy[POLICY_KEY[key]]||[],
        "Schema permission drift: "+module.id+"/"+key);
    }

    assert.deepEqual(module.read,module.permissions.read,
      "Legacy read must mirror V2 read permission for "+module.id);
    assert.deepEqual(module.write,module.permissions.publish,
      "Legacy write must mirror V2 publish permission for "+module.id);

    const direct=module.permissions.direct_save.length>0;
    const proposal=module.permissions.publish.length>0;
    assert.equal(module.mutation.direct_save_allowed,direct,
      "direct_save_allowed drift for "+module.id);
    assert.equal(module.mutation.proposal_allowed,proposal,
      "proposal_allowed drift for "+module.id);
    assert.equal(module.mutation.proposal_only,proposal&&!direct,
      "proposal_only drift for "+module.id);
    assert.equal(module.mutation.rollback_allowed,module.permissions.rollback.length>0,
      "rollback_allowed drift for "+module.id);

    assert.ok(module.editable_fields.length>0,
      "Writable/readable JSON module needs an editor contract: "+module.id);
    for(const field of module.editable_fields){
      assert.ok(field.path_pattern&&typeof field.path_pattern==="string");
      assert.ok(schema.field_types.includes(field.type),
        "Unknown field type "+field.type+" in "+module.id);
      assert.ok(field.validation&&typeof field.validation==="object",
        "Field validation metadata missing in "+module.id);
    }
  }else{
    assert.equal(module.canonical_source,null,"Read-only virtual module cannot declare canonical file: "+module.id);
    assert.deepEqual(module.editable_fields,[],"Read-only virtual module cannot expose editable fields: "+module.id);
    assert.deepEqual(module.permissions.read,module.read);
    for(const key of ["preflight","draft","publish","direct_save","rollback"])
      assert.deepEqual(module.permissions[key],[],"Virtual module mutation permission must be empty: "+module.id+"/"+key);
  }

  for(const sourceId of [...module.derived_sources,...module.related_sources]){
    assert.ok(sourceById.has(sourceId),"Unknown related/derived source "+sourceId+" in "+module.id);
  }
  for(const sourceId of module.derived_sources){
    assert.ok(["generated","derived"].includes(sourceById.get(sourceId).kind),
      "derived_sources must point to generated/derived registry entries: "+sourceId);
  }

  if(module.translation.aware){
    const family=familyById.get(module.translation.family);
    assert.ok(family,"Unknown translation family for "+module.id+": "+module.translation.family);
    assert.equal(family.source_id,module.translation.source_id,
      "Translation source mismatch for "+module.id);
    assert.ok(module.related_sources.includes(module.translation.source_id)||
      module.canonical_source===module.translation.source_id,
      "Translation source must belong to module source graph: "+module.id);
  }else{
    assert.equal(module.translation.family,null);
    assert.equal(module.translation.source_id,null);
  }
}

const directSavePaths=[...cmsPathsFor("directSave")].sort();
const surfacePaths=schema.editor_surfaces.map(surface=>surface.path).sort();
assert.deepEqual(surfacePaths,directSavePaths,
  "Schema V2 editor surfaces must cover every and only direct-save mutation path");

const surfaceIds=new Set();
for(const surface of schema.editor_surfaces){
  assert.ok(surface.id&&!surfaceIds.has(surface.id),"Duplicate editor surface id: "+surface.id);
  surfaceIds.add(surface.id);
  assert.ok(modulesById.has(surface.owner_module),"Unknown owner module: "+surface.owner_module);

  const source=sourceById.get(surface.source_id);
  assert.ok(source,"Unknown editor surface source: "+surface.source_id);
  assert.equal(source.path,surface.path,"Editor surface source/path mismatch: "+surface.id);

  const policy=CMS_PATH_POLICY[surface.path];
  assert.ok(policy,"Editor surface path missing mutation policy: "+surface.path);
  assert.deepEqual(surface.permissions.direct_save,policy.directSave,
    "Editor surface direct-save role drift: "+surface.id);
  assert.ok(surface.permissions.direct_save.length>0,
    "Editor surface must represent an actual direct-save path: "+surface.id);

  assert.ok(surface.record_locator&&surface.record_locator.type,
    "Editor surface needs record locator: "+surface.id);
  assert.ok(Array.isArray(surface.editable_fields)&&surface.editable_fields.length>0,
    "Editor surface needs explicit field whitelist: "+surface.id);
  for(const field of surface.editable_fields){
    assert.ok(field.path_pattern&&typeof field.path_pattern==="string",
      "Inline field pattern missing: "+surface.id);
    assert.ok(schema.field_types.includes(field.type),
      "Inline field type not registered: "+surface.id+"/"+field.type);
    assert.ok(field.validation&&typeof field.validation==="object",
      "Inline field validation missing: "+surface.id+"/"+field.path_pattern);
  }
  assert.ok(Array.isArray(surface.record_validation)&&surface.record_validation.length>0,
    "Inline record validation contract missing: "+surface.id);

  if(surface.translation.aware){
    const family=familyById.get(surface.translation.family);
    assert.ok(family,"Unknown inline translation family: "+surface.translation.family);
    assert.equal(family.source_id,surface.source_id,
      "Inline translation family source mismatch: "+surface.id);
  }
}

assert.equal(schema.modules.find(x=>x.id==="guide").translation.aware,false,
  "guide/data.json itself is not the knowledge translation source");
assert.equal(schema.editor_surfaces.find(x=>x.id==="knowledge-inline").translation.family,"knowledge");
assert.equal(schema.modules.find(x=>x.id==="foods").translation.family,"food");

const serialized=JSON.stringify(schema);
assert.equal(serialized.includes("cms.openphuquoc.com"),false,
  "Schema V2 must not treat cms.openphuquoc.com as a public origin");
assert.equal(serialized.includes("www.openphuquoc.com"),false,
  "Schema V2 must not encode legacy/public redirect origins");
assert.equal(serialized.includes("openphuquoc-v3"),false,
  "Schema metadata must remain deployment-independent");

console.log("CMS Schema V2 PASS:",schema.modules.length,
  "legacy-compatible modules;",schema.editor_surfaces.length,
  "direct-save editor surfaces; policy/source/translation contracts aligned.");
