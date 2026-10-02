import assert from "node:assert/strict";
import fs from "node:fs";

const read=path=>fs.readFileSync(new URL("../"+path,import.meta.url),"utf8");
const json=path=>JSON.parse(read(path));

const content=json("data/content.json");
const stories=content.stories||[];
assert.ok(stories.length>0,"Story catalog must not be empty");
const storyIds=new Set(stories.map(x=>x.id));
assert.equal(storyIds.size,stories.length,"Story IDs must be unique");
for(const story of stories){
  assert.ok(story.id&&story.title,"Every story needs id and title");
  assert.ok(String(story.image||"").trim(),"Every story card needs an image");
  assert.ok(Array.isArray(story.sections)&&story.sections.length>0,story.id+" must have article sections");
}

const support=json("data/home-support.json");
for(const item of support.curiosity||[]){
  assert.ok(item.story_id,"Curiosity item must point to a story: "+item.prompt_id);
  assert.ok(storyIds.has(item.story_id),"Curiosity story missing: "+item.story_id);
  const expected="stories/article.html?id="+encodeURIComponent(item.story_id);
  assert.equal(item.route,expected,"Curiosity route must match story_id: "+item.prompt_id);
}

const home=read("home-foundation-v2.js");
assert.match(home,/class="curiosity-story-link" href="/,
  "Curiosity image/title must be a real article link");
assert.match(home,/Xem nhanh vì sao ↓/,
  "Curiosity quick answer must remain a separate action");
assert.match(home,/Đọc câu chuyện đầy đủ →/,
  "Curiosity card must state the article navigation action");

const experience=read("home-experience-v1.js");
assert.match(experience,/href="stories\/article\.html\?id='\+encodeURIComponent\(x\.id\)\+'"/,
  "Homepage long-story cards must build href from each story id");

const storyJs=read("stories/story.js");
assert.doesNotMatch(storyJs,/data\.stories\.find\(x=>x\.id===id\)\|\|data\.stories\[0\]/,
  "An invalid story id must never silently render the first story");
assert.match(storyJs,/https:\/\/openphuquoc\.com["']?\+\(window\.OpenPQI18n\?\.localize/,
  "Story canonical must remain rooted at the public origin while allowing a reviewed locale prefix");
assert.doesNotMatch(storyJs,/https:\/\/cms\.openphuquoc\.com/,
  "CMS host must never be a public story canonical");

const guideJs=read("guide/knowledge.js");
assert.match(guideJs,/https:\/\/openphuquoc\.com"\+localized\(o\.route\)/,
  "Guide canonical must remain rooted at the public origin while allowing a reviewed locale prefix");
assert.doesNotMatch(guideJs,/https:\/\/cms\.openphuquoc\.com/,
  "CMS host must never be a public guide canonical");

const knowledge=json("data/knowledge/objects.json").objects||[];
const publicGuideIds=new Set(knowledge
  .filter(x=>x.status==="READY_PUBLIC"&&x.public_ready===true)
  .map(x=>x.topic_id));
const index=read("index.html");
const fallbackGuideIds=[...index.matchAll(/guide\/article\.html\?id=([^"'&<]+)/g)]
  .map(match=>decodeURIComponent(match[1]));
for(const id of fallbackGuideIds)
  assert.ok(publicGuideIds.has(id),"Homepage fallback guide is not public: "+id);

const homeLibrary=read("home-library.js");
for(const id of [...homeLibrary.matchAll(/id:"(knowledge_[^"]+)"/g)].map(x=>x[1]))
  assert.ok(publicGuideIds.has(id),"Homepage curated guide is not public: "+id);

const foodHome=read("home-experience-v1.js");
assert.match(foodHome,/class="food-now-card featured-food-card" href="/,
  "Homepage food card must be a whole-card article link");
assert.doesNotMatch(foodHome,/<article class="food-now-card featured-food-card">/,
  "Homepage food card must not leave image/title outside the link");
const foodJs=read("food/food.js");
assert.doesNotMatch(foodJs,/\|\|state\.data\.dishes\[0\]/,
  "Invalid food article ids must never silently render the first dish");
assert.match(foodJs,/Không tìm thấy món này/,
  "Food article needs an explicit not-found state");

const worker=read("worker.js");
assert.doesNotMatch(worker,/new URL\(url\.pathname, request\.url\)/,
  "Worker must not drop article query parameters before Static Assets");
assert.match(worker,/const routedUrl=new URL\(request\.url\)/,
  "Worker route normalization must start from the full request URL, including ?id=");
assert.match(worker,/const assetUrl = new URL\(routedUrl\)/,
  "Worker Static Assets handoff must preserve the normalized URL query string");
assert.doesNotMatch(worker,/routedUrl\.search\s*=/,
  "Locale routing must never rewrite or drop article query parameters");
const wrangler=json("wrangler.jsonc");
const workerFirst=wrangler.assets?.run_worker_first||[];
const routeCovered=route=>workerFirst.includes(route)||workerFirst.some(rule=>
  rule.endsWith("/*")&&route.startsWith(rule.slice(0,-1))
);
for(const route of ["/stories/article","/places/detail","/guide/article"])
  assert.ok(routeCovered(route),
    "Worker must intercept extensionless canonical article route: "+route);

const edge=read("functions/stories/article.html.js");
assert.match(edge,/status:404/,"Unknown story IDs must be a 404 at the edge");
assert.match(edge,/\.find\(o=>o\.id===id/,
  "Edge route must resolve the requested story id explicitly");

console.log("PASS article-card link contract:",stories.length,"stories,",(support.curiosity||[]).length,"curiosity routes and public guide fallbacks");
