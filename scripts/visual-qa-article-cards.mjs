import assert from "node:assert/strict";
import { chromium } from "playwright";
import fs from "node:fs";

const BASE=process.env.VISUAL_QA_BASE_URL||"http://127.0.0.1:4173";
fs.mkdirSync("visual-qa-results",{recursive:true});
const content=JSON.parse(fs.readFileSync("data/content.json","utf8"));
const storyById=new Map((content.stories||[]).map(x=>[x.id,x]));
const knowledge=JSON.parse(fs.readFileSync("data/knowledge/objects.json","utf8"));
const guideById=new Map((knowledge.objects||[])
  .filter(x=>x.status==="READY_PUBLIC"&&x.public_ready===true)
  .map(x=>[x.topic_id,x]));

const browser=await chromium.launch({headless:true});
// This suite validates the existing Vietnamese public experience. Locale routing
// is covered by the dedicated i18n QA, so keep this regression suite pinned to VI.
const context=await browser.newContext({viewport:{width:1280,height:820},locale:"vi-VN"});
const page=await context.newPage();

const storyIdFromHref=href=>new URL(href,BASE).searchParams.get("id");
async function assertStoryDestination(href,label){
  const id=storyIdFromHref(href);
  const expected=storyById.get(id);
  assert.ok(expected,label+" points to unknown story: "+href);
  await page.goto(new URL(href,BASE).href,{waitUntil:"domcontentloaded"});
  assert.equal(new URL(page.url()).searchParams.get("id"),id,label+" changed article id during navigation");
  const h1=page.locator("#articleRoot h1");
  await h1.waitFor({state:"visible",timeout:5000});
  assert.equal((await h1.textContent())?.trim(),expected.title,label+" opened the wrong story");
}

async function assertGuideDestination(href,label){
  const id=new URL(href,BASE).searchParams.get("id");
  const expected=guideById.get(id);
  assert.ok(expected,label+" points to unpublished/unknown guide: "+href);
  await page.goto(new URL(href,BASE).href,{waitUntil:"domcontentloaded"});
  const h1=page.locator("#knowledgeArticle h1");
  await h1.waitFor({state:"visible",timeout:5000});
  assert.equal((await h1.textContent())?.trim(),expected.title,label+" opened the wrong guide");
}

await page.goto(BASE+"/stories/",{waitUntil:"domcontentloaded"});
await page.locator("a.story-card").first().waitFor({state:"visible",timeout:5000});
const storyCardCount=await page.locator("a.story-card").count();
assert.equal(storyCardCount,storyById.size,"Stories listing must render every public story card");
for(let i=0;i<storyCardCount;i++){
  await page.goto(BASE+"/stories/",{waitUntil:"domcontentloaded"});
  const card=page.locator("a.story-card").nth(i);
  const href=await card.getAttribute("href");
  assert.ok(href,"Story card "+i+" is missing href");
  const id=storyIdFromHref(href);
  const expected=storyById.get(id);
  assert.ok(expected,"Story card "+i+" points to unknown id "+id);
  const img=card.locator("img");
  assert.equal(await img.count(),1,"Story card "+id+" must contain one image");
  assert.ok((await img.getAttribute("src"))?.trim(),"Story card "+id+" image src is empty");
  await img.click();
  await page.waitForURL(url=>url.pathname.endsWith("/stories/article.html")&&url.searchParams.get("id")===id,{timeout:5000});
  const h1=page.locator("#articleRoot h1");
  await h1.waitFor({state:"visible",timeout:5000});
  assert.equal((await h1.textContent())?.trim(),expected.title,"Story-card image opened wrong article");
}

await page.goto(BASE+"/",{waitUntil:"domcontentloaded"});
await page.locator("#islandStoryGrid .island-story-card").first().waitFor({state:"visible",timeout:7000});
const islandHrefs=await page.locator("#islandStoryGrid .island-story-card").evaluateAll(nodes=>nodes.map(x=>x.getAttribute("href")));
for(const [i,href] of islandHrefs.entries()){
  assert.ok(href,"Homepage island story "+i+" missing href");
  await page.goto(BASE+"/",{waitUntil:"domcontentloaded"});
  const card=page.locator('#islandStoryGrid .island-story-card[href="'+href.replaceAll('"','\\"')+'"]');
  await card.first().waitFor({state:"visible",timeout:7000});
  const id=storyIdFromHref(href);
  await card.first().locator("img").click();
  await page.waitForURL(url=>url.pathname.endsWith("/stories/article.html")&&url.searchParams.get("id")===id,{timeout:5000});
  const h1=page.locator("#articleRoot h1");await h1.waitFor({state:"visible",timeout:5000});
  assert.equal((await h1.textContent())?.trim(),storyById.get(id)?.title,"Homepage long-story image opened wrong article");
}

await page.goto(BASE+"/",{waitUntil:"domcontentloaded"});
await page.locator("#curiosityRail .curiosity-story-link").first().waitFor({state:"visible",timeout:7000});
const curiosityHrefs=await page.locator("#curiosityRail .curiosity-story-link").evaluateAll(nodes=>nodes.map(x=>x.getAttribute("href")));
for(const [i,href] of curiosityHrefs.entries()){
  assert.ok(href,"Curiosity card "+i+" missing article href");
  await page.goto(BASE+"/",{waitUntil:"domcontentloaded"});
  const link=page.locator('#curiosityRail .curiosity-story-link[href="'+href.replaceAll('"','\\\"')+'"]').first();
  await link.waitFor({state:"visible",timeout:7000});
  const id=storyIdFromHref(href);
  await link.locator("img").click();
  await page.waitForURL(url=>url.pathname.endsWith("/stories/article.html")&&url.searchParams.get("id")===id,{timeout:5000});
  const h1=page.locator("#articleRoot h1");await h1.waitFor({state:"visible",timeout:5000});
  assert.equal((await h1.textContent())?.trim(),storyById.get(id)?.title,"Curiosity image/title opened wrong article");
}
await page.goto(BASE+"/",{waitUntil:"domcontentloaded"});
const quick=page.locator("#curiosityRail .curiosity-toggle").first();
await quick.waitFor({state:"visible",timeout:7000});
const before=page.url();
await quick.click();
assert.equal(page.url(),before,"Quick curiosity answer must not navigate");
assert.equal(await quick.getAttribute("aria-expanded"),"true","Quick curiosity answer must expand");
assert.ok(await page.locator("#curiosityRail .curiosity-answer").first().isVisible(),"Quick curiosity answer content must be visible");

await page.goto(BASE+"/",{waitUntil:"domcontentloaded"});
const library=page.locator("#home-library");
await library.scrollIntoViewIfNeeded();
await page.locator("#home-library .home-library-card[data-guide-id]").first().waitFor({state:"visible",timeout:7000});
const guideHrefs=await page.locator("#home-library .home-library-card").evaluateAll(nodes=>nodes.map(x=>x.getAttribute("href")));
assert.ok(guideHrefs.length>=3,"Homepage should expose at least three guide cards");
for(const [i,href] of guideHrefs.entries()){
  assert.ok(href,"Homepage guide "+i+" missing href");
  await page.goto(BASE+"/",{waitUntil:"domcontentloaded"});
  const libraryNow=page.locator("#home-library");await libraryNow.scrollIntoViewIfNeeded();
  const id=new URL(href,BASE).searchParams.get("id");
  const card=page.locator('#home-library .home-library-card[data-guide-id="'+id+'"]').first();
  await card.waitFor({state:"visible",timeout:7000});
  await card.click();
  await page.waitForURL(url=>url.pathname.endsWith("/guide/article.html")&&url.searchParams.get("id")===id,{timeout:5000});
  const h1=page.locator("#knowledgeArticle h1");await h1.waitFor({state:"visible",timeout:5000});
  assert.equal((await h1.textContent())?.trim(),guideById.get(id)?.title,"Homepage guide card opened wrong article");
}

await page.goto(BASE+"/",{waitUntil:"domcontentloaded"});
await page.locator("#foodNowGrid .food-now-card.featured-food-card").first().waitFor({state:"visible",timeout:7000});
const foodCards=page.locator("#foodNowGrid a.food-now-card.featured-food-card");
const foodCount=await foodCards.count();
assert.ok(foodCount>=1,"Homepage food cards must render");
for(let i=0;i<foodCount;i++){
  await page.goto(BASE+"/",{waitUntil:"domcontentloaded"});
  const card=page.locator("#foodNowGrid a.food-now-card.featured-food-card").nth(i);
  await card.waitFor({state:"visible",timeout:7000});
  const href=await card.getAttribute("href");assert.ok(href,"Homepage food card missing href");
  const id=new URL(href,BASE).searchParams.get("id");
  await card.locator("figure").click();
  await page.waitForURL(url=>url.pathname.endsWith("/food/article.html")&&url.searchParams.get("id")===id,{timeout:5000});
  await page.locator("#foodArticle h1").waitFor({state:"visible",timeout:5000});
  assert.equal(await page.locator("#foodArticle").getAttribute("data-food-id"),id,"Homepage food card opened wrong dish");
}

await page.goto(BASE+"/",{waitUntil:"domcontentloaded"});
await page.locator("#hotNowList a.hot-card").first().waitFor({state:"visible",timeout:7000});
const newsCards=page.locator("#hotNowList a.hot-card");
for(let i=0;i<await newsCards.count();i++){
  const card=newsCards.nth(i);
  assert.ok(await card.getAttribute("href"),"Homepage news card "+i+" missing href");
  await card.click({trial:true});
}

await page.goto(BASE+"/stories/article.html?id=__missing_story__",{waitUntil:"domcontentloaded"});
await page.locator("#articleRoot h1").waitFor({state:"visible",timeout:5000});
assert.match((await page.locator("#articleRoot h1").textContent())||"",/Không tìm thấy bài viết này/,
  "Invalid story id must render not-found state");
assert.notEqual((await page.locator("#articleRoot h1").textContent())?.trim(),content.stories?.[0]?.title,
  "Invalid story id must never render the first story");
await page.goto(BASE+"/food/article.html?id=__missing_dish__",{waitUntil:"domcontentloaded"});
await page.locator("#foodArticle").waitFor({state:"visible",timeout:5000});
assert.match((await page.locator("#foodArticle").innerText())||"",/Không tìm thấy món này/,
  "Invalid food id must render a not-found state instead of dish zero");

await browser.close();
console.log("PASS browser article-card clicks:",storyCardCount,"story cards,",islandHrefs.length,"homepage stories,",curiosityHrefs.length,"curiosity links,",guideHrefs.length,"guide cards and",foodCount,"food cards");
