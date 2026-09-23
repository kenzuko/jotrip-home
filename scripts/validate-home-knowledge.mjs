import fs from "node:fs";
const homepage=fs.readFileSync("index.html","utf8");
const css=fs.readFileSync("styles.css","utf8");
const view=JSON.parse(fs.readFileSync("data/views/knowledge-public.json","utf8"));
const errors=[];
const publicIds=new Set(view.objects.map(x=>x.topic_id));
if(view.count!==128||publicIds.size!==128)errors.push("Public knowledge count or unique ID mismatch");
if(!homepage.includes('id="home-library"'))errors.push("Homepage public library section missing");
if(!homepage.includes('class="hero-knowledge-pill"'))errors.push("Homepage hero library link missing");
if(!homepage.includes('href="guide/knowledge.html"'))errors.push("Public library entry missing");
if(!css.includes(".home-library-grid")||!css.includes(".hero-knowledge-pill"))errors.push("Homepage library styling missing");
const featured=[...homepage.matchAll(/href="guide\/article\.html\?id=([^"]+)"/g)].map(x=>x[1]);
if(featured.length!==4)errors.push("Expected 4 public featured articles, got "+featured.length);
for(const id of featured)if(!publicIds.has(id))errors.push("Featured article not public: "+id);
const categories=[...homepage.matchAll(/href="guide\/knowledge\.html\?category=([A-Z_]+)"/g)].map(x=>x[1]);
const types=new Set(view.objects.map(x=>x.topic_type));
for(const cat of categories)if(!types.has(cat))errors.push("Unknown public category: "+cat);
if(errors.length){console.error("Home knowledge QA failed:",errors.join("; "));process.exit(1);}
console.log("Home knowledge QA OK:",view.count,"public articles,",featured.length,"featured articles,",categories.length,"category links.");
