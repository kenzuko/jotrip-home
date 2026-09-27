import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {join} from "node:path";
const root=process.env.OPENPQ_DIST||"dist",base="https://cms.openphuquoc.com";
const xml=readFileSync(join(root,"sitemap.xml"),"utf8");
const robots=readFileSync(join(root,"robots.txt"),"utf8");
assert.match(xml,/<urlset xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9">/);
const urls=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1].replace(/&amp;/g,"&"));
assert.ok(urls.length>=30,"Sitemap must include published content");
assert.equal(urls.length,new Set(urls).size,"No duplicate canonical URLs");
assert.ok(urls.every(url=>url.startsWith(base+"/")));
assert.ok(urls.every(url=>!url.includes("/admin/")&&!url.includes("/api/")&&!url.includes("/data/")));
for(const url of urls.filter(u=>u.includes("/guide/article.html?id=")||u.includes("/stories/article.html?id="))){
  assert.ok(new URL(url).searchParams.get("id"),"No empty article id");
}
const guide=JSON.parse(readFileSync(join(root,"data/views/knowledge-public.json"),"utf8"));
const stories=JSON.parse(readFileSync(join(root,"data/content.json"),"utf8"));
const publicStories=(stories.stories||[]).filter(o=>o.id&&!["draft","pending","review","scheduled"].includes(o.status));
const publicGuides=(guide.objects||[]).filter(o=>o.topic_id&&o.status!=="draft"&&o.public_ready!==false);
assert.equal(urls.filter(u=>u.includes("/guide/article.html?id=")).length,publicGuides.length);
assert.equal(urls.filter(u=>u.includes("/stories/article.html?id=")).length,publicStories.length);
assert.match(robots,/Disallow: \/admin\//);
assert.ok(!robots.includes("Disallow: /data/"),"Do not block public JSON used in rendering");
assert.match(robots,/Sitemap: https:\/\/cms.openphuquoc.com\/sitemap.xml/);
assert.ok(existsSync(join(root,"index.html")));
console.log("SEO sitemap test PASS:",urls.length,"URLs,",publicGuides.length,"guides,",publicStories.length,"stories");
