import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const js=fs.readFileSync(new URL("../home-library.js",import.meta.url),"utf8");
const published=JSON.parse(fs.readFileSync(new URL("../data/knowledge/objects.json",import.meta.url),"utf8"))
  .objects.filter(o=>o.status==="READY_PUBLIC"&&o.public_ready===true)
  .map(o=>({topic_id:o.topic_id,title:o.title,topic_type:o.topic_type,
    route:"/guide/article.html?id="+encodeURIComponent(o.topic_id),
    short_summary:o.editorial.short_summary}));
assert.equal(published.length,128,"Current public article count should be 128");

async function render(date,objects=published){
  const grid={children:[],replaceChildren(...nodes){this.children=nodes;}};
  const count={textContent:""},allLink={textContent:""},mobileCta={textContent:""};
  const section={querySelector(selector){
    if(selector===".home-library-grid")return grid;
    if(selector===".home-library-count")return count;
    if(selector===".home-library-all-link")return allLink;
    if(selector===".home-library-mobile-cta")return mobileCta;
    throw new Error("Unexpected DOM selector "+selector);
  }};
  class FixedDate extends Date {
    constructor(...args){super(...(args.length?args:[date+"T09:00:00+07:00"]));}
  }
  const document={
    getElementById(id){assert.equal(id,"home-library");return section;},
    createElement(tag){return {tag,children:[],textContent:"",className:"",href:"",
      append(...nodes){this.children.push(...nodes);}};}
  };
  const fetch=async url=>{
    assert.equal(url,"/data/views/knowledge-home.json");
    return {ok:true,json:async()=>({count:objects.length,objects})};
  };
  vm.runInNewContext(js,{document,window:{},Date:FixedDate,Intl,fetch});
  // Homepage loader is async but has no timers or externally scheduled work.
  await new Promise(resolve=>setImmediate(resolve));
  return {cards:grid.children,count:count.textContent,allLink:allLink.textContent};
}
const one=await render("2026-09-25");
const same=await render("2026-09-25");
const next=await render("2026-09-26");
for(const result of [one,same,next]){
  assert.equal(result.cards.length,4,"One lead and three distinct discovery items");
  assert.equal(new Set(result.cards.map(card=>card.href)).size,4,"No duplicate articles");
  assert.equal(new Set(result.cards.slice(0,3).map(card=>card.children[0].textContent)).size,3,
    "Three visible mobile articles must represent three different subjects");
  assert.ok(result.cards.every(card=>!card.href.includes("nha-ve-sinh")),
    "Utility directory articles must never appear in Cẩm nang homepage cards");
  assert.match(result.count,/128/);
}
assert.match(one.cards[0].href,/knowledge_116_cho-phu-quoc-co-that-su-leo-cay/,
  "First editorial lead is the Phú Quốc dog curiosity story");
assert.deepEqual(one.cards.map(x=>x.href),same.cards.map(x=>x.href),
  "Refreshing on the same day must not reshuffle articles");
assert.match(next.cards[0].href,/knowledge_008_rach-vem/,
  "Next local day must rotate to Rạch Vẹm");
const reduced=await render("2026-09-25",published.filter(o=>o.topic_type==="PRACTICAL"));
assert.equal(reduced.cards.length,0,"No published editorials means keep static fallback");
console.log("Homepage Cẩm nang editorial rotation tests passed: curated lead, daily stability, topic diversity, no utility articles.");
