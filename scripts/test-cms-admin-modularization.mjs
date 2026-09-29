import assert from "node:assert/strict";
import fs from "node:fs";

const read=path=>fs.readFileSync(path,"utf8");
const admin=read("admin/admin.js"),index=read("admin/index.html");

for(const file of ["module-registry.js","module-validation.js","editor-fields.js"]){
  assert.match(index,new RegExp(file.replace(".","\\.")+"\\?v=\\d+"),file+" must load in Admin");
}
assert.ok(index.indexOf("module-registry.js")<index.indexOf("admin.js"),"registry must load before admin.js");
assert.ok(index.indexOf("module-validation.js")<index.indexOf("admin.js"),"validation must load before admin.js");
assert.ok(index.indexOf("editor-fields.js")<index.indexOf("admin.js"),"field renderer must load before admin.js");

assert.match(admin,/window\.OPQModuleValidation/);
assert.match(admin,/window\.OPQModuleRegistry/);
assert.match(admin,/window\.OPQEditorFields/);
assert.match(admin,/function canWriteCurrent\(\)/);
assert.doesNotMatch(admin,/function primitiveField\(/,"generic primitive renderer must no longer live in admin.js");
assert.doesNotMatch(admin,/function renderNode\(/,"generic recursive renderer must no longer live in admin.js");
assert.doesNotMatch(admin,/CMS phải còn ít nhất một Admin đang hoạt động\./,
  "module validation rules must live in module-validation.js, not admin.js");
assert.match(admin,/https:\/\/openphuquoc\.com\/admin\//,
  "legacy preview fallback must stay rooted at the public canonical origin");
assert.doesNotMatch(admin,/new URL\([^\n]*cms\.openphuquoc\.com/,
  "admin preview must never use cms.openphuquoc.com as public origin");

console.log("PASS CMS admin modularization: registry, validation and generic fields extracted without public-origin drift");
