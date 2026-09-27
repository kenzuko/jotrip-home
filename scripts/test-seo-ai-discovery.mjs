import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync("functions/_shared/seo-html.js","utf8");
const seo=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
const canonical="https://cms.openphuquoc.com/";
const html=readFileSync("index.html","utf8");
const scripts=[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
assert.ok(scripts.length>0,"Homepage must expose schema.org JSON-LD without JavaScript execution");
const docs=scripts.map(m=>JSON.parse(m[1]));
const graph=docs.flatMap(d=>d["@graph"]||[d]);
const org=graph.find(x=>x["@type"]==="Organization"&&x.name==="Open Phu Quoc");
const website=graph.find(x=>x["@type"]==="WebSite"&&x.name==="Open Phu Quoc");
assert.ok(org&&website,"Organization and WebSite must be discoverable");
assert.equal(org.url,canonical);
assert.equal(org.logo.url,canonical+"assets/logo-master.png");
assert.equal(website.publisher["@id"],org["@id"]);
assert.equal(website.inLanguage,"vi-VN");
assert.ok(!html.includes("JoTrip DMC"),"Portal SEO should not be a JoTrip sales funnel");
assert.match(html,/<link rel="canonical" href="https:\/\/cms.openphuquoc.com\/">/);

const story={
 id:"safe-example",title:"Chuyện trên đảo",dek:"Một ghi chép ngắn từ Phú Quốc",
 intro:"Không có chuyện phải bịa ngày đăng.",
 updated_at:"2026-09-26"
};
const meta=seo.buildStoryMeta(story);
const json=JSON.parse(seo.structured(meta));
assert.equal(json["@type"],"Article");
assert.equal(json.mainEntityOfPage["@id"],canonical+"stories/article.html?id=safe-example");
assert.equal(json.publisher.logo.url,canonical+"assets/logo-master.png");
assert.equal(json.author.logo.url,canonical+"assets/logo-master.png");
assert.equal(json.dateModified,"2026-09-26");
assert.ok(!Object.hasOwn(json,"datePublished"),"Do not fabricate unknown publication dates");
const withDate={...story,published_at:"2026-09-22"};
assert.equal(JSON.parse(seo.structured(seo.buildStoryMeta(withDate))).datePublished,"2026-09-22");
const longMeta=seo.buildStoryMeta({...story,dek:"Đây là một bài viết được công bố. ".repeat(20)});
assert.ok(longMeta.description.length<=158,"Avoid truncated search snippets");
const knowledge={topic_id:"knowledge_99",title:"Hòn đảo",route:"/guide/article.html?id=knowledge_99",updated_at:"2026-09-26",
 editorial:{short_summary:"Lưu ý trên đảo",practical:"Thông tin thực địa",before_you_go:["Kiểm tra dự báo"]}};
const info=JSON.parse(seo.structured(seo.buildKnowledgeMeta(knowledge)));
assert.equal(info.publisher.logo.url,canonical+"assets/logo-master.png");
assert.equal(info.dateModified,"2026-09-26");
console.log("SEO AI DISCOVERY PASS: JSON-LD Organization/WebSite, real publisher logo, correct canonical and honest article dates");
