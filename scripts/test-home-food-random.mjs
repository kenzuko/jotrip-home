import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {runInNewContext} from "node:vm";

// Regression: a malformed inline card string previously stopped the entire
// homepage module and left the "Đang tìm món..." placeholder forever.
execFileSync(process.execPath, ["--check", "home-experience-v1.js"], {stdio:"pipe"});
const html=readFileSync("index.html","utf8");
assert.equal((html.match(/class="section food-now-section"/g)||[]).length,1);
assert.doesNotMatch(html,/food-home-shortcut/);
assert.match(html,/id="foodRandomBtn"/);

const food=JSON.parse(readFileSync("data/food.json","utf8"));
const visuals=JSON.parse(readFileSync("data/visual-context.json","utf8"));
assert.ok(food.dishes.length>=20,"meal catalogue must be present");

const nodes={
  foodNowGrid:{innerHTML:"Đang chọn món..."},
  foodNowContext:{textContent:"Gợi ý theo giờ Phú Quốc"},
  foodRandomBtn:{disabled:true,handlers:{},addEventListener(event,callback){this.handlers[event]=callback;}}
};
const randomMath=Object.create(Math);
randomMath.random=()=>0;
const mock={
  document:{querySelector(selector){return selector.startsWith("#")?nodes[selector.slice(1)]||null:null;}},
  window:{addEventListener(){}},
  fetch:async (url)=>({ok:true,json:async()=>url.includes("visual-context")?visuals:food}),
  Date,Intl,Math:randomMath,Promise,encodeURIComponent,
  setTimeout(){},setInterval(){}
};
runInNewContext(readFileSync("home-experience-v1.js","utf8"),mock,{filename:"home-experience-v1.js"});
await new Promise(resolve=>setTimeout(resolve,10));
assert.match(nodes.foodNowGrid.innerHTML,/featured-food-card/);
assert.match(nodes.foodNowGrid.innerHTML,/Xem món này/);
assert.doesNotMatch(nodes.foodNowGrid.innerHTML,/Đang chọn món/);
const urls = () => nodes.foodNowGrid.innerHTML.split('href="food/article.html?id=').slice(1).map(x => x.split('"')[0]);
const first=urls();
assert.equal(first.length,3,"One suggestion must show exactly 3 cards");
assert.equal(new Set(first).size,3,"Three different dishes per draw");
assert.equal(nodes.foodRandomBtn.disabled,false,"random control should be available");
assert.equal(typeof nodes.foodRandomBtn.handlers.click,"function");
nodes.foodRandomBtn.handlers.click();
const next=urls();
assert.equal(next.length,3);
assert.equal(new Set(next).size,3);
assert.equal(first.filter(x=>next.includes(x)).length,0,"Avoid repeating the previous three when there are enough dishes");
console.log("Homepage food: three unique in-place suggestions, working redraw and valid JS PASS");
