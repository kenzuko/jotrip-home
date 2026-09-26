import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const gallerySrc=fs.readFileSync("core/hero-gallery.js","utf8");
const contextSrc=fs.readFileSync("core/hero-context.js","utf8");
const sandbox={window:{},Intl,Date,Math};
vm.runInNewContext(gallerySrc,sandbox);
vm.runInNewContext(contextSrc,sandbox);
const {items,shelves,choose,variant,vnDay}=sandbox.window.OpenPQHeroGallery;
const ids=new Set(items.map(item=>item.id));
assert.equal(items.length,ids.size,"Each image needs a unique ID");
assert.ok(items.length>=32&&items.length<=40,"Hero master should contain 32-40 curated scenes");
assert.equal(items.filter(item=>item.mobile).length,0,"Hero should reuse responsive master scenes instead of shipping multi-megabyte portrait duplicates");
assert.equal(vnDay(new Date("2026-09-25T18:00:00Z")),"2026-09-26","Stable UTC+7 day");
for(const item of items){
  assert.ok(item.label&&item.alt&&item.credit&&item.src&&item.topic,
    "Photo metadata incomplete: "+item.id);
  assert.ok(!/shutterstock/i.test(item.src),"No stock copyright photos: "+item.id);
  if(item.src.startsWith("/assets/")){
    assert.ok(fs.existsSync(item.src.slice(1)),"Missing verified local photo: "+item.src);
  }else{
    assert.ok(item.sourceUrl?.startsWith("https://commons.wikimedia.org/wiki/File:"),
      "External images must link to exact original: "+item.id);
    if(item.licenseUrl)assert.ok(/^https:\/\/(?:creativecommons\.org|creativecommons\.org\/publicdomain)/.test(item.licenseUrl),
      "Declared reuse license must link to Creative Commons: "+item.id);
    assert.ok(item.credit.length>=3,"External photographer credit required: "+item.id);
  }
  assert.equal(variant(item,true).src,item.src,"Responsive hero uses the same verified master scene");
}
const scenes=["morning","noon","afternoon","sunset","night","cloudy","rainy"];
for(const mood of scenes){
  assert.ok(shelves[mood],"Missing gallery for "+mood);
  assert.ok(shelves[mood].leads.length>=3&&shelves[mood].support.length>=6,
    "Each pool must have visual variety: "+mood);
  const all=[...shelves[mood].leads,...shelves[mood].support];
  all.forEach(id=>assert.ok(ids.has(id),"Unknown photo "+id+" in "+mood));
  for(const day of ["2026-09-26T02:00:00Z","2026-09-26T16:00:00Z","2026-09-27T02:00:00Z"]){
    const album=choose(mood,new Date(day));
    assert.equal(album.length,4,"Exactly four slides in "+mood);
    assert.equal(new Set(album.map(x=>x.id)).size,4,"No duplicates in one album");
  }
  const a=choose(mood,new Date("2026-09-26T02:00:00Z")).map(x=>x.id);
  const b=choose(mood,new Date("2026-09-26T10:00:00Z")).map(x=>x.id);
  assert.equal(a.join(","),b.join(","),"Revisiting the same time bucket on the same day must stay stable");
  const c=choose(mood,new Date("2026-09-27T02:00:00Z"));
  assert.notEqual(a[0],c[0].id,"The editorial lead rotates on the next local day");
}
const ctx=sandbox.window.OpenPQHeroContext;
assert.equal(ctx.select(new Date("2026-09-26T00:00:00Z")).mood,"morning");
assert.equal(ctx.select(new Date("2026-09-26T06:00:00Z")).mood,"noon");
assert.equal(ctx.select(new Date("2026-09-26T09:00:00Z")).mood,"afternoon");
assert.equal(ctx.select(new Date("2026-09-26T10:30:00Z")).mood,"sunset");
assert.equal(ctx.select(new Date("2026-09-26T14:00:00Z")).mood,"night");
for(const name of ["rainy-night","cloudy-night"])assert.equal(choose(name).length,4);
const html=fs.readFileSync("index.html","utf8");
const app=fs.readFileSync("app.js","utf8");
assert.ok(html.indexOf('src="core/hero-gallery.js?')<html.indexOf('src="app.js?'),
  "Gallery must load before app");
assert.ok(html.includes("data-hero-license")&&html.includes("data-hero-source"),
  "Exact author and Creative Commons license links must be visible");
assert.match(app,/heroGallery\?\.choose\(mood,new Date\(\)\)/);
assert.match(app,/heroMobile\.addEventListener/);
assert.match(app,/pendingMood/);
assert.match(app,/photo\.onerror=/);
assert.match(app,/updateHeroCredit/);
assert.equal((html.match(/class="hero-slide(?: is-active)?"/g)||[]).length,4);
console.log("Hero gallery PASS:",items.length,"curated scenes / 7 contexts / 4 scenes per view / exact source attribution.");
