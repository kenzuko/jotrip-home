import assert from "node:assert/strict";
import fs from "node:fs";
const read=path=>fs.readFileSync(path,"utf8");

const story=read("core/cms-inline-edit.js");
const food=read("core/cms-inline-food.js");
const pages=read("core/cms-inline-pages.js");
const stat=read("core/cms-inline-static.js");
assert.match(story,/OPQDirectSaveRollback\?\.mount\([^\n]*result\.commit/);
assert.match(food,/OPQDirectSaveRollback\?\.mount\([^\n]*result\.commit/);
assert.match(pages,/OPQDirectSaveRollback\?\.mount\([^\n]*result\.commit/);
assert.match(stat,/cms-direct-save-rollback\.js\?v=1/);
assert.match(stat,/mountRollback\(result\.commit\)/);

for(const [path,needle] of [
  ["stories/article.html",'../core/cms-direct-save-rollback.js?v=1'],
  ["food/article.html",'../core/cms-direct-save-rollback.js?v=1'],
  ["guide/article.html",'/core/cms-direct-save-rollback.js?v=1'],
  ["index.html",'core/cms-direct-save-rollback.js?v=1']
]) assert.ok(read(path).includes(needle),path+" must load direct-save rollback helper");

const helper=read("core/cms-direct-save-rollback.js");
assert.match(helper,/direct_save_commit/);
assert.match(helper,/\/api\/cms\/rollback/);
assert.match(helper,/Tạo PR hoàn tác/);
assert.doesNotMatch(helper,/git\/refs\/heads\/main|force\s*:\s*true/,
  "browser rollback helper must remain proposal-only and never mutate main");
console.log("PASS CMS direct-save rollback UI: all inline editors offer proposal-only undo");
