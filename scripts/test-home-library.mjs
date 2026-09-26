import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const js=fs.readFileSync(new URL("../home-library.js",import.meta.url),"utf8");
const html=fs.readFileSync(new URL("../index.html",import.meta.url),"utf8");
const published=JSON.parse(fs.readFileSync(new URL("../data/knowledge/objects.json",import.meta.url),"utf8"))
  .objects.filter(o=>o.status==="READY_PUBLIC"&&o.public_ready===true);
assert.equal(published.length,128,"Published guide count");
const curated=new Set([
  "knowledge_014_bai-sao","knowledge_056_bun-quay-phu-quoc",
  "knowledge_125_cau-ca-lon","knowledge_067_nha-thung-nuoc-mam",
  "knowledge_126_cau-muc-dem","knowledge_133_night-market",
  "knowledge_137_visit-fish-sauce-house-pepper-farm"
]);
assert.ok([...curated].every(id=>published.some(o=>o.topic_id===id)),
  "Homepage must not feature an unpublished article");
const fixture=published.map(o=>({
  topic_id:o.topic_id,title:o.title,topic_type:o.topic_type,
  route:"/guide/article.html?id="+encodeURIComponent(o.topic_id),
  short_summary:o.editorial.short_summary,
  image:curated.has(o.topic_id)?{url:"/assets/media/test-public-approved.jpg",alt:o.title}:null
}));

async function render(date,records=fixture){
  const grid={children:[],replaceChildren(...nodes){this.children=nodes;},
    addEventListener(){}};
  const count={textContent:""},allLink={textContent:""},mobileCta={textContent:""};
  const section={querySelector(selector){
    return ({
      ".home-library-grid":grid,
      ".home-library-count":count,
      ".home-library-all-link":allLink,
      ".home-library-mobile-cta":mobileCta
    })[selector]||null;
  }};
  class FixedDate extends Date {
    constructor(...args){super(...(args.length?args:[date+"T09:00:00+07:00"]));}
  }
  const document={
    getElementById(id){assert.equal(id,"home-library");return section;},
    createElement(tag){return {
      tagName:tag.toUpperCase(),children:[],dataset:{},textContent:"",
      append(...nodes){this.children.push(...nodes);}
    };}
  };
  let calls=0;
  const fetch=async url=>{
    calls++;
    assert.equal(url,"/data/views/knowledge-home.json");
    return {ok:true,json:async()=>({count:records.length,objects:records})};
  };
  vm.runInNewContext(js,{document,window:{},Date:FixedDate,Intl,fetch});
  await new Promise(resolve=>setImmediate(resolve));
  return {cards:grid.children,count:count.textContent,allLink:allLink.textContent,calls};
}
const first=await render("2026-09-25");
const same=await render("2026-09-25");
const second=await render("2026-09-26");
for(const result of [first,same,second]){
  assert.equal(result.calls,1,"Fetch guide summaries once");
  assert.equal(result.cards.length,4,"Four approved practical guides");
  assert.equal(new Set(result.cards.map(card=>card.dataset.guideId)).size,4,
    "No repeated guide");
  assert.ok(result.cards.every(card=>curated.has(card.dataset.guideId)),
    "Only practical editorial picks are allowed");
  assert.equal(result.cards[0].children[0].tagName,"FIGURE",
    "Use image-left editorial card layout");
  assert.ok(result.cards.every(card=>card.children[0].children[0].src.startsWith("/assets/media/")),
    "Only feed-approved images are rendered");
  assert.match(result.count,/128/);
}
assert.equal(first.cards[0].dataset.guideId,"knowledge_014_bai-sao",
  "First lead restores the Bãi Sao practical guide");
assert.equal(second.cards[0].dataset.guideId,"knowledge_014_bai-sao",
  "Lead remains stable across a week, even when companions change");
const secondWeek=await render("2026-10-02");
assert.equal(secondWeek.cards[0].dataset.guideId,"knowledge_056_bun-quay-phu-quoc",
  "The next week's lead rotates without an editor selecting it manually");
assert.deepEqual(first.cards.map(x=>x.dataset.guideId),same.cards.map(x=>x.dataset.guideId),
  "Refreshing within one local day does not reshuffle the shelf");
// The supporting shelf can surface photographed, published articles beyond
// the original seven hand-written homepage picks, while remaining stable daily.
const extraIds=new Set([
  "knowledge_057_goi-ca-trich","knowledge_124_cano-3-dao",
  "knowledge_134_cable-car-hon-thom","knowledge_131_sunset-watching"
]);
const expanded=fixture.map(o=>extraIds.has(o.topic_id)?{
  ...o,image:{url:"/assets/media/test-public-approved.jpg",alt:o.title}
}:o);
const extraDays=[];
for(const date of ["2026-09-25","2026-09-26","2026-09-27","2026-09-28","2026-09-29"]){
  const result=await render(date,expanded);
  extraDays.push(...result.cards.slice(1).map(x=>x.dataset.guideId));
}
assert.ok(extraDays.some(id=>extraIds.has(id)),
  "Additional published photo guides must become eligible for the homepage");
assert.deepEqual((await render("2026-09-26",expanded)).cards.map(x=>x.dataset.guideId),
  (await render("2026-09-26",expanded)).cards.map(x=>x.dataset.guideId),
  "Companion selection remains stable within a local day");
const noPhoto=await render("2026-09-25",fixture.map(o=>({...o,image:null})));
assert.equal(noPhoto.cards.length,0,"Missing photos keep the pre-rendered HTML fallback");
assert.ok(!html.slice(html.indexOf('id="home-library"'),html.indexOf('id="near-me"'))
  .includes("Chó Phú Quốc có thật sự leo cây"),"Curiosity content is not in Cẩm nang");
assert.match(html,/CHUYỆN ĐẢO \/ HUYỀN TÍCH \/ TÒ MÒ/);
assert.ok(html.includes('id="curiosityRail"')&&html.includes('id="islandStoryGrid"'),
  "Quick questions and long reads are grouped within Chuyện đảo");
console.log("Homepage role split tests passed: practical/photo-led Cẩm nang, stable rotation, Chuyện đảo grouping.");

