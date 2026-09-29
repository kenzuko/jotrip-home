import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {URL} from "node:url";

const source=fs.readFileSync(new URL("../admin/module-registry.js",import.meta.url),"utf8");
const root={};
vm.runInNewContext(source,{window:root,globalThis:root,URL});
const r=root.OPQModuleRegistry;

const modules=[
  {id:"home",read:["admin","editor","viewer"],write:["admin","editor"],
    permissions:{read:["admin","editor","viewer"],publish:["admin","editor"]},
    preview:"../",preview_route:"/"},
  {id:"guide",read:["admin","editor","viewer"],write:["admin","editor"],
    permissions:{read:["admin","editor","viewer"],publish:["admin","editor"]},
    preview:"../guide/",preview_route:"/guide/"},
  {id:"traffic",read:["admin"],write:[],permissions:{read:["admin"],publish:[]},preview:null,preview_route:null},
  {id:"users",read:["admin"],write:["admin"],permissions:{read:["admin"],publish:["admin"]},preview:null,preview_route:null}
];

assert.equal(r.PUBLIC_ORIGIN,"https://openphuquoc.com");
assert.deepEqual([...r.permitted(modules,"viewer").map(x=>x.id)],["home","guide"]);
assert.equal(r.resolve(modules,"editor","users"),null);
assert.equal(r.resolve(modules,"admin","users").id,"users");
assert.equal(r.resolve(modules,"viewer","dashboard").id,"dashboard");
assert.equal(r.writable(modules[0],"editor"),true);
assert.equal(r.writable(modules[0],"viewer"),false);
assert.deepEqual({...r.flags({id:"traffic"})},{dashboard:false,analytics:false,traffic:true});

assert.deepEqual([...r.ownerScope(modules,{login:"someone",role:"admin"}).map(x=>x.id)],
  ["home","guide","users"],"Traffic stays owner-only even for another admin");
assert.ok(r.ownerScope(modules,{login:"kenzuko",role:"admin"}).some(x=>x.id==="traffic"));

assert.equal(r.previewUrl(modules[0]),"https://openphuquoc.com/");
assert.equal(r.previewUrl(modules[1]),"https://openphuquoc.com/guide/");
assert.equal(r.previewUrl({preview:"../stories/",preview_route:null}),"https://openphuquoc.com/stories/");
assert.equal(r.previewUrl({preview:"https://cms.openphuquoc.com/guide/",preview_route:"/guide/"}),
  "https://openphuquoc.com/guide/","Schema V2 public route wins over any legacy preview value");
assert.equal(r.previewUrl({preview:null,preview_route:null}),null);
assert.equal(r.previewUrl({preview:null,preview_route:"https://cms.openphuquoc.com/"}),null,
  "Absolute/cms preview routes are rejected");

console.log("PASS CMS module registry extraction and public canonical preview lock");
