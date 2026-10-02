import {chromium} from "playwright";
import fs from "node:fs";

const BASE=process.env.VISUAL_QA_BASE_URL||"http://127.0.0.1:4173";
const ORIGIN=new URL(BASE).origin;
const manifest=JSON.parse(fs.readFileSync("data/i18n/routes.json","utf8"));
const staticRoutes=(manifest.static_shells||[]).filter(x=>x.selector==="static");
const nativeRoutes=(manifest.static_shells||[]).filter(x=>x.selector==="native");
// Full route ownership/injection is already enforced by test-static-language-shell.mjs.
// Browser QA only samples representative layout families; dynamic locale behavior is
// exercised separately below on a tiny set of routes with the real page runtime.
const representativePaths=new Set([
  "/",
  "/weather/",
  "/transit/",
  "/go/",
  "/stories/",
  "/food/article.html",
  "/currency/",
  "/cano/history/"
]);
const browserRoutes=staticRoutes.filter(x=>representativePaths.has(x.path));
if(browserRoutes.length!==representativePaths.size){
  const present=new Set(browserRoutes.map(x=>x.path));
  throw new Error("Missing representative i18n route(s): "+[...representativePaths].filter(x=>!present.has(x)).join(", "));
}
const browser=await chromium.launch({headless:true});
const failures=[];

function fail(route,viewport,reason,detail=""){failures.push({route,viewport,reason,detail})}
async function blockExternal(context){
  await context.route("**/*",async route=>{
    try{
      if(new URL(route.request().url()).origin===ORIGIN)return route.fallback();
    }catch{}
    return route.abort();
  });
}
async function blockLayoutNoise(context){
  await context.route("**/*",async route=>{
    try{
      const u=new URL(route.request().url());
      if(u.origin!==ORIGIN)return route.abort();
      const type=route.request().resourceType();
      if(["script","image","font","media","xhr","fetch","eventsource","websocket"].includes(type))return route.abort();
      return route.fallback();
    }catch{return route.abort()}
  });
}
async function workerlessEnglishFulfill(context){
  await context.route(/\/en(?:\/|$)/,async route=>{
    const u=new URL(route.request().url());
    const basePath=u.pathname.replace(/^\/en(?=\/|$)/,"")||"/";
    const source=await fetch(BASE+basePath+u.search);
    if(!source.ok)return route.fulfill({status:source.status,body:await source.text()});
    let html=await source.text();
    html=html.replace(/<html([^>]*)lang=["'][^"']+["']([^>]*)>/i,'<html$1lang="en"$2>');
    html=html.replace(/<head>/i,'<head><meta name="openpq-locale" content="en"><script src="/core/i18n-runtime.js?v=4" defer></script><script src="/core/en-full-site.js?v=2" defer></script><script src="/core/language-switcher.js?v=4" defer></script>');
    html=html.replace(/(<body[^>]*>)/i,'$1<nav class="opq-language-auto" data-openpq-language-switcher-auto data-openpq-language-switcher-server aria-label="Language"><div class="opq-language-options"><a href="/weather/?lang=vi">VI</a><a href="/en/weather/?lang=en">EN</a></div></nav>');
    await route.fulfill({status:200,contentType:"text/html; charset=utf-8",body:html});
  });
}
async function pool(items,limit,fn){
  let next=0;
  const workers=Array.from({length:Math.min(limit,items.length)},async()=>{
    while(true){
      const index=next++;
      if(index>=items.length)return;
      await fn(items[index]);
    }
  });
  await Promise.all(workers);
}
async function checkStaticRoute(context,route,width){
  const page=await context.newPage();
  page.setDefaultTimeout(2500);
  try{
    const response=await page.goto(BASE+route.path,{waitUntil:"domcontentloaded",timeout:4500});
    if(!response?.ok()){fail(route.path,width,"http",response?.status()||0);return}
    const selector=page.locator('[data-openpq-language-static]');
    const count=await selector.count();
    if(count!==1){fail(route.path,width,"selector-count",count);return}
    const box=await selector.boundingBox();
    if(!box||box.x<-1||box.x+box.width>width+1)fail(route.path,width,"selector-overflow",JSON.stringify(box));
    const hrefs=await selector.locator('a').evaluateAll(xs=>xs.map(x=>({lang:x.dataset.openpqLang,href:x.getAttribute('href')})));
    if(!hrefs.some(x=>x.lang==="vi")||!hrefs.some(x=>x.lang==="en"))fail(route.path,width,"missing-vi-en",JSON.stringify(hrefs));
    const overlaps=await selector.evaluate(el=>{
      const header=el.closest("header");if(!header)return[];
      const a=el.getBoundingClientRect();
      const visible=x=>{const s=getComputedStyle(x),r=x.getBoundingClientRect();return s.display!=="none"&&s.visibility!=="hidden"&&r.width>0&&r.height>0};
      return [...header.querySelectorAll("a,button,input,select")]
        .filter(x=>!el.contains(x)&&visible(x))
        .map(x=>{const b=x.getBoundingClientRect();const w=Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left));const h=Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));return {tag:x.tagName,id:x.id||"",className:String(x.className||""),area:w*h}})
        .filter(x=>x.area>4);
    });
    if(overlaps.length)fail(route.path,width,"selector-overlap",JSON.stringify(overlaps.slice(0,4)));
  }catch(error){fail(route.path,width,"exception",String(error.message||error))}
  finally{await page.close({runBeforeUnload:false}).catch(()=>{})}
}
async function checkNativeRoute(context,route,width){
  const page=await context.newPage();page.setDefaultTimeout(2500);
  try{
    await page.goto(BASE+route.path,{waitUntil:"domcontentloaded",timeout:4500});
    const common=await page.locator('[data-openpq-language-static]').count();
    const native=await page.locator('#languageSelect').count();
    if(common!==0||native!==1)fail(route.path,width,"native-selector-duplication",`common=${common} native=${native}`);
  }catch(error){fail(route.path,width,"exception",String(error.message||error))}
  finally{await page.close({runBeforeUnload:false}).catch(()=>{})}
}

for(const width of [320,390,768,1366]){
  console.log(`[i18n-qa] layout-only ${width}px: ${browserRoutes.length} representative static shells + ${nativeRoutes.length} native shell`);
  const height=width<500?844:900;
  const context=await browser.newContext({viewport:{width,height},locale:"vi-VN",serviceWorkers:"block"});
  await blockLayoutNoise(context);
  await pool(browserRoutes,4,route=>checkStaticRoute(context,route,width));
  await pool(nativeRoutes,1,route=>checkNativeRoute(context,route,width));
  await context.close().catch(()=>{});
}

console.log("[i18n-qa] ordered browser-language behavior + VI zero-catalog selector path");
// Browser language order matters. VI first must stay VI even if EN is a later
// preference. This full-runtime smoke also proves the static selector itself does
// not require the locale catalog on a normal VI Weather load.
{
  const context=await browser.newContext({viewport:{width:390,height:844},locale:"vi-VN",serviceWorkers:"block"});
  await context.addInitScript(()=>Object.defineProperty(navigator,"languages",{get:()=>["vi-VN","en-US"]}));
  await blockExternal(context);await workerlessEnglishFulfill(context);
  const page=await context.newPage();page.setDefaultTimeout(3000);
  const catalog=[];page.on("request",r=>{if(r.url().includes("/data/i18n/catalog.json"))catalog.push(r.url())});
  try{
    await page.goto(BASE+"/weather/?point=duong-dong#today",{waitUntil:"domcontentloaded",timeout:6000});
    await page.waitForTimeout(150);
    if(new URL(page.url()).pathname!=="/weather/")fail("/weather/",390,"vi-primary-browser-misdirected",page.url());
    const stored=await page.evaluate(()=>({local:localStorage.getItem("openpq_lang"),cookie:document.cookie}));
    if(stored.local||stored.cookie.includes("openpq_lang="))fail("/weather/",390,"browser-detect-wrote-manual-preference",JSON.stringify(stored));
    if(catalog.length)fail("/weather/",390,"selector-caused-catalog-fetch",catalog.join(","));
  }catch(error){fail("/weather/",390,"ordered-browser-locale-exception",String(error.message||error))}
  finally{await page.close({runBeforeUnload:false}).catch(()=>{});await context.close().catch(()=>{})}
}

console.log("[i18n-qa] EN auto-detect + remembered manual VI/EN");
// With no manual preference, an English browser follows the published English
// counterpart. A manual VI choice then wins over the browser on later visits.
{
  const context=await browser.newContext({viewport:{width:390,height:844},locale:"en-US",serviceWorkers:"block"});
  await blockExternal(context);await workerlessEnglishFulfill(context);
  const page=await context.newPage();page.setDefaultTimeout(3000);
  try{
    await page.goto(BASE+"/weather/?point=duong-dong#today",{waitUntil:"domcontentloaded",timeout:6000});
    await page.waitForURL(/\/en\/weather\//,{timeout:4000});
    if(!page.url().includes("point=duong-dong")||!page.url().endsWith("#today"))fail("/en/weather/",390,"browser-detect-lost-query-hash",page.url());
    const autoStored=await page.evaluate(()=>({local:localStorage.getItem("openpq_lang"),cookie:document.cookie}));
    if(autoStored.local||autoStored.cookie.includes("openpq_lang="))fail("/en/weather/",390,"auto-en-wrote-manual-preference",JSON.stringify(autoStored));
    await page.waitForFunction(()=>document.documentElement.dataset.openpqEnglishReady==="true",{timeout:4000}).catch(()=>{});
    const selectorState=await page.evaluate(()=>({
      staticCount:document.querySelectorAll('[data-openpq-language-static]').length,
      viHref:document.querySelector('[data-openpq-language-static] [data-openpq-lang="vi"]')?.getAttribute('href')||'',
      legacyVisible:[...document.querySelectorAll('.opq-language-auto')].filter(x=>getComputedStyle(x).display!=="none").length
    }));
    if(selectorState.staticCount!==1)fail("/en/weather/",390,"english-static-selector-count",JSON.stringify(selectorState));
    if(selectorState.viHref!=="/weather/?point=duong-dong#today")fail("/en/weather/",390,"english-static-vi-link-not-hydrated",JSON.stringify(selectorState));
    if(selectorState.legacyVisible!==0)fail("/en/weather/",390,"legacy-selector-visible",JSON.stringify(selectorState));

    await page.locator('[data-openpq-language-static] [data-openpq-lang="vi"]').click();
    await page.waitForURL(url=>url.pathname==="/weather/",{timeout:4000});
    await page.waitForTimeout(100);
    if(new URL(page.url()).pathname!=="/weather/")fail("/weather/",390,"manual-vi-bounced-back",page.url());
    const storedVi=await page.evaluate(()=>({local:localStorage.getItem("openpq_lang"),cookie:document.cookie}));
    if(storedVi.local!=="vi"||!storedVi.cookie.includes("openpq_lang=vi"))fail("/weather/",390,"manual-vi-not-persisted",JSON.stringify(storedVi));

    await page.goto(BASE+"/weather/?point=duong-dong#today",{waitUntil:"domcontentloaded",timeout:6000});
    await page.waitForTimeout(100);
    if(new URL(page.url()).pathname!=="/weather/")fail("/weather/",390,"remembered-vi-lost-to-browser",page.url());

    await page.locator('[data-openpq-language-static] [data-openpq-lang="en"]').click();
    await page.waitForURL(/\/en\/weather\//,{timeout:4000});
    const storedEn=await page.evaluate(()=>({local:localStorage.getItem("openpq_lang"),cookie:document.cookie}));
    if(storedEn.local!=="en"||!storedEn.cookie.includes("openpq_lang=en"))fail("/en/weather/",390,"manual-en-not-persisted",JSON.stringify(storedEn));
  }catch(error){fail("/weather/",390,"preference-roundtrip-exception",String(error.message||error))}
  finally{await page.close({runBeforeUnload:false}).catch(()=>{});await context.close().catch(()=>{})}
}

console.log("[i18n-qa] legacy ?lang canonicalization");
// Old ?lang= links remain compatible without making static VI pages Worker-first.
{
  const context=await browser.newContext({viewport:{width:390,height:844},locale:"vi-VN",serviceWorkers:"block"});
  await blockExternal(context);await workerlessEnglishFulfill(context);
  const page=await context.newPage();page.setDefaultTimeout(3000);
  try{
    await page.goto(BASE+"/weather/?lang=en&point=duong-dong#today",{waitUntil:"domcontentloaded",timeout:6000});
    await page.waitForURL(/\/en\/weather\//,{timeout:4000});
    const u=new URL(page.url());
    if(u.searchParams.has("lang")||u.searchParams.get("point")!=="duong-dong"||u.hash!=="#today")fail("/weather/",390,"legacy-lang-not-canonicalized",page.url());
    const stored=await page.evaluate(()=>localStorage.getItem("openpq_lang"));
    if(stored!=="en")fail("/weather/",390,"legacy-lang-not-remembered",stored||"");
  }catch(error){fail("/weather/",390,"legacy-lang-exception",String(error.message||error))}
  finally{await page.close({runBeforeUnload:false}).catch(()=>{});await context.close().catch(()=>{})}
}

console.log("[i18n-qa] query-sensitive Food article selector");
// Query-sensitive selectors fail closed in raw HTML, then hydrate a complete
// href in the browser so normal, new-tab and modified clicks keep the record id.
{
  const context=await browser.newContext({viewport:{width:390,height:844},locale:"vi-VN",serviceWorkers:"block"});
  await blockExternal(context);await workerlessEnglishFulfill(context);
  const page=await context.newPage();page.setDefaultTimeout(3000);
  try{
    await page.goto(BASE+"/food/article.html?id=bun-quay#ingredients",{waitUntil:"domcontentloaded",timeout:6000});
    const link=page.locator('[data-openpq-language-static] [data-openpq-lang="en"]');
    const href=await link.getAttribute("href"),target=await link.getAttribute("data-openpq-target");
    if(href!=="/en/food/article.html?id=bun-quay#ingredients"||target!=="/en/food/article.html")fail("/food/article.html",390,"query-sensitive-link-not-hydrated",`href=${href} target=${target}`);
    await link.click();
    await page.waitForURL(/\/en\/food\/article\.html/,{timeout:4000});
    const u=new URL(page.url());
    if(u.searchParams.get("id")!=="bun-quay"||u.hash!=="#ingredients")fail("/en/food/article.html",390,"article-id-or-hash-lost",page.url());
  }catch(error){fail("/food/article.html",390,"article-query-exception",String(error.message||error))}
  finally{await page.close({runBeforeUnload:false}).catch(()=>{});await context.close().catch(()=>{})}
}

await browser.close().catch(()=>{});
if(failures.length){console.error(JSON.stringify(failures,null,2));process.exit(1)}
console.log(`PASS browser i18n QA: all ${staticRoutes.length} static shells structurally gated; ${browserRoutes.length} representative static shells + ${nativeRoutes.length} native shell across 4 viewports; no overlap; ordered device-language routing + no implicit preference writes + remembered VI/EN + legacy links + hydrated article query targets + English runtime compatibility`);
