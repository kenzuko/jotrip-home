import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source=fs.readFileSync("admin/admin.js","utf8");
function extract(name){
  const match=source.match(new RegExp("^function "+name+"\\(\\)\\{[\\s\\S]*?^\\}","m"));
  assert.ok(match,"Missing "+name+"()");
  return match[0];
}
function run(name,{query,moduleId,fields=[],proof=null}){
  const focused=[];
  const card={
    dataset:{foodId:"food_test",venueId:"venue_test"},
    classList:{add(value){assert.equal(value,"quality-focus")}},
    scrollIntoView(options){assert.equal(options.block,"center")},
    querySelectorAll(selector){assert.equal(selector,"[data-path]");return fields},
    querySelector(selector){assert.equal(selector,".venue-location-proof");return proof}
  };
  const context={
    URLSearchParams,
    location:{search:query},
    currentModule:{id:moduleId},
    document:{querySelectorAll(selector){assert.match(selector,/data-(food|venue)-id/);return [card]}}
  };
  vm.runInNewContext(extract(name),context);
  context[name]();
  return focused;
}
function field(path,value=""){
  return {dataset:{path},value,focus(options){this.didFocus=true;this.focusOptions=options}};
}

{
  const target=field("entities.0.legacy_id","old_article");
  run("focusRequestedFood",{query:"?record=food_test&field=legacy_id",moduleId:"foods",fields:[target]});
  assert.equal(target.didFocus,true,"Food task should focus its requested field");
  assert.equal(target.focusOptions.preventScroll,true,"Focus should preserve the existing scroll position");
}
{
  const target=field("entities.0.coordinate_source_ref");
  const proof={open:false};
  run("focusRequestedVenue",{query:"?record=venue_test&field=coordinate_source_ref",moduleId:"venues",fields:[target],proof});
  assert.equal(proof.open,true,"Coordinate evidence section should open");
  assert.equal(target.didFocus,true,"Venue task should focus its requested coordinate evidence field");
}
{
  const emptyLatitude=field("entities.0.latitude","");
  const longitude=field("entities.0.longitude","103.9");
  run("focusRequestedVenue",{query:"?record=venue_test&field=latitude%2Flongitude",moduleId:"venues",fields:[longitude,emptyLatitude]});
  assert.equal(emptyLatitude.didFocus,true,"Missing latitude should be selected first");
  assert.equal(longitude.didFocus,undefined);
}
{
  const target=field("entities.2.latitude","10.1");
  const longitude=field("entities.2.longitude","");
  run("focusRequestedVenue",{query:"?record=venue_test&field=latitude%2Flongitude",moduleId:"venues",fields:[target,longitude]});
  assert.equal(longitude.didFocus,true,"When latitude exists, missing longitude should be selected");
}
console.log("CMS quality navigation tests passed: Food fields, coordinate evidence disclosure, and missing coordinates.");
