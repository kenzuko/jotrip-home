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

const loader=read("core/cms-editor-loader.js");
assert.match(loader,/cms-direct-save-rollback\.js\?v=1/);
for(const [path,type] of [
  ["stories/article.html","story"],
  ["food/article.html","food"],
  ["guide/article.html","page"],
  ["index.html","page"]
]){
  const html=read(path);
  assert.ok(html.includes('/core/cms-editor-loader.js?v=1'),path+" must expose the CMS-only editor loader");
  assert.ok(html.includes('dataset.cmsEditor="'+type+'"'),path+" must select the correct CMS editor");
}

const helper=read("core/cms-direct-save-rollback.js");
assert.match(helper,/direct_save_commit/);
assert.match(helper,/\/api\/cms\/rollback/);
assert.match(helper,/Tạo PR hoàn tác/);
assert.doesNotMatch(helper,/git\/refs\/heads\/main|force\s*:\s*true/,
  "browser rollback helper must remain proposal-only and never mutate main");
console.log("PASS CMS direct-save rollback UI: all inline editors offer proposal-only undo");
