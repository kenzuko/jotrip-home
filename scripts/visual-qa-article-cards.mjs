import assert from "node:assert/strict";
import { chromium } from "playwright";
import fs from "node:fs";

const BASE=process.env.VISUAL_QA_BASE_URL||"http://127.0.0.1:4173";
const content=JSON.parse(fs.readFileSync("data/content.json","utf8"));
const storyById=new Map((content.stories||[]).map(x=>[x.id,x]));
const knowledge=JSON.parse(fs.readFileSync("data/knowledge/objects.json","utf8"));
const guideById=new Map((knowledge.objects||[])
  .filter(x=>x.status==="READY_PUBLIC"&&x.public_ready===true)
  .map(x=>[x.topic_id,x]));

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1280,height:820}});
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

// Click every story-card image surface, not merely inspect href attributes.
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

// Homepage long stories: click the image within each rendered card.
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

// Curiosity has two explicit actions: image/title navigates; quick-answer expands in place.
await page.goto(BASE+"/",{waitUntil:"domcontentloaded"});
await page.locator("#curiosityRail .curiosity-story-link").first().waitFor({state:"visible",timeout:7000});
const curiosityHrefs=await page.locator("#curiosityRail .curiosity-story-link").evaluateAll(nodes=>nodes.map(x=>x.getAttribute("href")));
for(const [i,href] of curiosityHrefs.entries()){
  assert.ok(href,"Curiosity card "+i+" missing article href");
  await assertStoryDestination(href,"Curiosity card "+i);
}
await page.goto(BASE+"/",{waitUntil:"domcontentloaded"});
const quick=page.locator("#curiosityRail .curiosity-toggle").first();
await quick.waitFor({state:"visible",timeout:7000});
const before=page.url();
await quick.click();
assert.equal(page.url(),before,"Quick curiosity answer must not navigate");
assert.equal(await quick.getAttribute("aria-expanded"),"true","Quick curiosity answer must expand");
assert.ok(await page.locator("#curiosityRail .curiosity-answer").first().isVisible(),"Quick curiosity answer content must be visible");

// Homepage guide cards must open their exact public article.
await page.goto(BASE+"/",{waitUntil:"domcontentloaded"});
const library=page.locator("#home-library");
await library.scrollIntoViewIfNeeded();
await page.locator("#home-library .home-library-card").first().waitFor({state:"visible",timeout:7000});
const guideHrefs=await page.locator("#home-library .home-library-card").evaluateAll(nodes=>nodes.map(x=>x.getAttribute("href")));
assert.ok(guideHrefs.length>=3,"Homepage should expose at least three guide cards");
for(const [i,href] of guideHrefs.entries()){
  assert.ok(href,"Homepage guide "+i+" missing href");
  await assertGuideDestination(href,"Homepage guide "+i);
}

// Invalid IDs must never fall through to article zero.
await page.goto(BASE+"/stories/article.html?id=__missing_story__",{waitUntil:"domcontentloaded"});
await page.locator("#articleRoot h1").waitFor({state:"visible",timeout:5000});
assert.match((await page.locator("#articleRoot h1").textContent())||"",/Không tìm thấy bài viết này/,
  "Invalid story id must render not-found state");
assert.notEqual((await page.locator("#articleRoot h1").textContent())?.trim(),content.stories?.[0]?.title,
  "Invalid story id must never render the first story");

await browser.close();
console.log("PASS browser article-card clicks:",storyCardCount,"story cards,",islandHrefs.length,"homepage stories,",curiosityHrefs.length,"curiosity links and",guideHrefs.length,"guide cards");
