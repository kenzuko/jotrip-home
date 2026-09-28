import assert from "node:assert/strict";
import {existsSync,readFileSync,readdirSync,statSync} from "node:fs";

const strict=process.argv.includes("--strict");
const read=path=>{
  assert.ok(existsSync(path),"Missing required file: "+path);
  return readFileSync(path,"utf8");
};

const worker=read("worker.js");
const seo=read("functions/_shared/seo-html.js");
const sitemap=read("scripts/build-seo-sitemap.mjs");
const seoSitemapTest=read("scripts/test-seo-sitemap.mjs");
const seoRenderTest=read("scripts/test-seo-render.mjs");
const workerConfig=read("wrangler.jsonc");
const pagesConfig=read("wrangler.pages.jsonc");
const cmsSetup=read("CMS_SETUP.md");
const admin=read("admin/index.html");
const cloudflareBuild=read("scripts/build-cloudflare.mjs");
const cmsMiddleware=read("functions/_middleware.js");
const routes=read("scripts/routes.json");

assert.match(workerConfig,/"name"\s*:\s*"openphuquoc-v3"/,"Worker runtime must remain present");
assert.match(workerConfig,/"CMS_DB"/,"Worker D1 binding must remain present");
assert.match(pagesConfig,/"pages_build_output_dir"/,"CMS Pages runtime must remain present");
assert.match(pagesConfig,/"CMS_DB"/,"CMS Pages D1 binding must remain present");
assert.match(cmsSetup,/cms\.openphuquoc\.com/,"CMS origin documentation must remain explicit during migration");
assert.match(admin,/\/api\/cms\//,"Admin must keep using the CMS API surface");

const publicOrigin="https://openphuquoc.com";
const cmsOrigin="https://cms.openphuquoc.com";

const publicHtmlFiles=[];
const walkPublicHtml=dir=>{
  for(const name of readdirSync(dir)){
    if(name===".git"||name==="dist"||name==="node_modules"||name==="admin")continue;
    const path=dir==="."?name:dir+"/"+name;
    const stat=statSync(path);
    if(stat.isDirectory())walkPublicHtml(path);
    else if(name.endsWith(".html"))publicHtmlFiles.push(path);
  }
};
walkPublicHtml(".");
const publicHtmlCmsLeaks=publicHtmlFiles.filter(path=>readFileSync(path,"utf8").includes(cmsOrigin));

const gates=[
  {
    id:"seo-shared-origin",
    ok:seo.includes(publicOrigin) && !/SEO_ORIGIN\s*=\s*["']https:\/\/cms\.openphuquoc\.com/.test(seo),
    detail:"Shared SEO metadata must canonicalize to the public origin."
  },
  {
    id:"worker-public-origin",
    ok:!worker.includes('const SITE_ORIGIN = "'+cmsOrigin+'"')
      && !worker.includes("const SITE_ORIGIN='"+cmsOrigin+"'")
      && (!worker.includes("SITE_ORIGIN") || worker.includes(publicOrigin)),
    detail:"Worker SEO metadata must not identify the CMS hostname as the public site."
  },
  {
    id:"sitemap-public-origin",
    ok:sitemap.includes(publicOrigin) && !sitemap.includes('const base="'+cmsOrigin+'"'),
    detail:"sitemap.xml and robots.txt must advertise openphuquoc.com."
  },
  {
    id:"seo-tests-public-origin",
    ok:!seoSitemapTest.includes(cmsOrigin) && !seoRenderTest.includes(cmsOrigin),
    detail:"Regression tests must enforce the public canonical origin."
  },
  {
    id:"admin-noindex",
    ok:/name=["']robots["'][^>]*noindex|noindex[^>]*name=["']robots["']/i.test(admin),
    detail:"The admin shell must explicitly be noindex."
  },
  {
    id:"edge-noindex",
    ok:cloudflareBuild.includes("/admin/*") && cloudflareBuild.includes("/api/*") &&
      cloudflareBuild.includes("X-Robots-Tag: noindex, nofollow, noarchive"),
    detail:"Cloudflare static headers must reinforce noindex for admin/API surfaces."
  },
  {
    id:"public-html-no-cms-host",
    ok:publicHtmlCmsLeaks.length===0,
    detail:publicHtmlCmsLeaks.length
      ? "Public HTML still exposes CMS hostname: "+publicHtmlCmsLeaks.join(", ")
      : "No public HTML may expose the CMS hostname."
  },
  {
    id:"cms-public-redirect",
    ok:cmsMiddleware.includes('CMS_HOST = "cms.openphuquoc.com"') &&
      cmsMiddleware.includes('PUBLIC_ORIGIN = "https://openphuquoc.com"') &&
      cmsMiddleware.includes("Response.redirect(publicUrl(url), 301)") &&
      cmsMiddleware.includes("openpq_cms") &&
      routes.includes('"/*"'),
    detail:"Anonymous CMS public navigation must 301 to the public domain while editor sessions remain available."
  }
];

console.log("\nOpen Phu Quoc domain-unification preflight");
console.log("Mode:",strict?"STRICT target gate":"AUDIT only");
for(const gate of gates){
  console.log((gate.ok?"PASS":"PENDING")+"  "+gate.id+" - "+gate.detail);
}

const pending=gates.filter(g=>!g.ok);
console.log("\nTarget gates:",gates.length-pending.length+"/"+gates.length,"pass");
if(pending.length){
  console.log("Pending:",pending.map(g=>g.id).join(", "));
  if(strict) process.exitCode=1;
}
console.log("\nManual cutover gates (not automatable in repo):");
console.log("- GitHub OAuth remains on cms.openphuquoc.com so CMS sessions and inline editing are not migrated.");
console.log("- Anonymous cms.openphuquoc.com public navigation returns path-preserving 301 to openphuquoc.com.");
console.log("- Authenticated CMS editors can keep using the CMS mirror, which is noindex.");
console.log("- Search Console sitemap/canonical check completed after production cutover");
