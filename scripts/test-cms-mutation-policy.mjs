import assert from "node:assert/strict";
import {
  cmsCan,cmsCanAny,cmsPathsFor,cmsRolesFor,cmsSupports
} from "../functions/_shared/cms-mutation-policy.js";

const all=["admin","editor","operator","viewer"];

assert.deepEqual(cmsRolesFor("data/content.json","read"),all);
assert.deepEqual(cmsRolesFor("data/content.json","preflight"),all);
assert.equal(cmsCan("editor","data/content.json","publish"),true);
assert.equal(cmsCan("operator","data/content.json","publish"),false);

assert.equal(cmsCan("operator","data/utilities.json","publish"),true);
assert.equal(cmsCan("editor","data/utilities.json","publish"),false);
assert.equal(cmsCan("operator","data/entities/destination-venues.json","publish"),true);

assert.equal(cmsCan("viewer","data/visual-context.json","read"),true);
assert.equal(cmsCan("operator","data/visual-context.json","read"),false);
assert.equal(cmsCan("editor","data/visual-context.json","publish"),true);

assert.equal(cmsCan("admin","data/knowledge/objects.json","read"),true);
assert.equal(cmsCan("admin","data/knowledge/objects.json","directSave"),true);
assert.equal(cmsSupports("data/knowledge/objects.json","preflight"),false);
assert.equal(cmsSupports("data/knowledge/objects.json","publish"),false);
assert.equal(cmsSupports("data/knowledge/objects.json","rollback"),false);

for(const path of ["data/home-copy.json","data/content.json","data/i18n/vi/food.json","data/knowledge/objects.json"]){
  assert.equal(cmsCan("admin",path,"directSave"),true,path+" must remain direct-save enabled for Admin");
}
assert.equal(cmsPathsFor("directSave").length,4);
assert.equal(cmsCanAny("admin","directSave"),true);
assert.equal(cmsCanAny("editor","directSave"),false);

for(const path of ["data/home-copy.json","data/content.json","guide/data.json","data/utilities.json","data/entities/destination-venues.json","data/entities/food.json"]){
  assert.equal(cmsCan("admin",path,"rollback"),true,path+" must remain rollback eligible");
}
assert.equal(cmsPathsFor("rollback").length,6);
assert.equal(cmsSupports("data/i18n/vi/food.json","rollback"),false);
assert.equal(cmsCanAny("admin","rollback"),true);
assert.equal(cmsCanAny("editor","rollback"),false);

assert.equal(cmsCan("admin","cms/users.json","read"),true);
assert.equal(cmsCan("admin","cms/users.json","preflight"),true);
assert.equal(cmsCan("admin","cms/users.json","publish"),true);
assert.equal(cmsCan("editor","cms/users.json","read"),false);
assert.equal(cmsCan("editor","data/content.json","draft"),true);
assert.equal(cmsCan("operator","data/content.json","draft"),false);
assert.equal(cmsCan("operator","data/utilities.json","draft"),true);
assert.equal(cmsCan("admin","data/knowledge/objects.json","draft"),true);
assert.equal(cmsCan("viewer","data/visual-context.json","draft"),false);
assert.equal(cmsCan("admin","cms/users.json","draft"),true);
assert.equal(cmsSupports("../secrets.json","read"),false);
assert.equal(cmsCan("admin","../secrets.json","publish"),false);

console.log("CMS mutation policy PASS: existing read, preflight, publish, direct-save and rollback permissions are locked.");
