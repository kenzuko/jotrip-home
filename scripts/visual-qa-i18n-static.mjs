import {chromium} from "playwright";
import fs from "node:fs";

const BASE=process.env.VISUAL_QA_BASE_URL||"http://127.0.0.1:4173";
const manifest=JSON.parse(fs.readFileSync("data/i18n/routes.json","utf8"));
const staticRoutes=(manifest.static_shells||[]).filter(x=>x.selector==="static");
const nativeRoutes=(manifest.static_shells||[]).filter(x=>x.selector==="native");
const browser=await chromium.launch({headless:true});
const failures=[];

function fail(route,viewport,reason,detail=""){failures.push({route,viewport,reason,detail})}
async function workerlessEnglishFulfill(context){
  await context.route(/\/en(?:\/|$)/,async route=>{
    const u=new URL(route.request().url());
    const basePath=u.pathname.replace(/^\/en(?=\/|$)/,"")||"/";
    const source=await fetch(BASE+basePath+u.search);
    if(!source.ok)return route.fulfill({status:source.status,body:await source.text()});
    let html=await source.text();
    html=html.replace(/<html([^>]*)lang=["'][^"']+["']([^>]*)>/i,'<html$1lang="en"$2>');
    html=html.replace(/<head>/i,'<head><meta name="openpq-locale" content="en">');
    await route.fulfill({status:200,contentType:"text/html; charset=utf-8",body:html});
  });
}

for(const width of [320,390,768,1366]){
  const height=width<500?844:900;
  const context=await browser.newContext({viewport:{width,height},locale:"vi-VN"});
  for(const route of staticRoutes){
    const page=await context.newPage();
    const catalog=[];page.on("request",r=>{if(r.url().includes("/data/i18n/catalog.json"))catalog.push(r.url())});
    try{
      const response=await page.goto(BASE+route.path,{waitUntil:"domcontentloaded",timeout:15000});
      if(!response?.ok()){fail(route.path,width,"http",response?.status()||0);continue}
      const count=await page.locator('[data-openpq-language-static]').count();
      if(count!==1)fail(route.path,width,"selector-count",count);
      const box=await page.locator('[data-openpq-language-static]').boundingBox();
      if(!box||box.x<-1||box.x+box.width>width+1)fail(route.path,width,"selector-overflow",JSON.stringify(box));
      const hrefs=await page.locator('[data-openpq-language-static] a').evaluateAll(xs=>xs.map(x=>({lang:x.dataset.openpqLang,href:x.getAttribute('href')})));
      if(!hrefs.some(x=>x.lang==="vi")||!hrefs.some(x=>x.lang==="en"))fail(route.path,width,"missing-vi-en",JSON.stringify(hrefs));
      if(["/","/weather/","/transit/"].includes(route.path)&&catalog.length)fail(route.path,width,"selector-caused-catalog-fetch",catalog.join(","));
    }catch(error){fail(route.path,width,"exception",String(error.message||error))}
    finally{await page.close()}
  }
  for(const route of nativeRoutes){
    const page=await context.newPage();
    try{
      await page.goto(BASE+route.path,{waitUntil:"domcontentloaded",timeout:15000});
      const common=await page.locator('[data-openpq-language-static]').count();
      const native=await page.locator('#languageSelect').count();
      if(common!==0||native!==1)fail(route.path,width,"native-selector-duplication",`common=${common} native=${native}`);
    }catch(error){fail(route.path,width,"exception",String(error.message||error))}
    finally{await page.close()}
  }
  await context.close();
}

// First visit only detects the browser language. It does not force-navigation.
// Once the visitor chooses a language, that explicit preference is remembered
// and may safely redirect future unprefixed static pages.
{
  const context=await browser.newContext({viewport:{width:390,height:844},locale:"en-US"});
  await workerlessEnglishFulfill(context);
  const page=await context.newPage();
  try{
    await page.goto(BASE+"/weather/?point=duong-dong#today",{waitUntil:"domcontentloaded",timeout:15000});
    if(new URL(page.url()).pathname!=="/weather/")fail("/weather/",390,"first-visit-forced-redirect",page.url());
    const suggested=await page.evaluate(()=>document.documentElement.dataset.openpqSuggestLang||"");
    if(suggested!=="en")fail("/weather/",390,"browser-language-not-detected",suggested);

    await page.locator('[data-openpq-language-static] [data-openpq-lang="en"]').click();
    await page.waitForURL(/\/en\/weather\//,{timeout:5000});
    if(!page.url().includes("point=duong-dong")||!page.url().endsWith("#today"))fail("/en/weather/",390,"manual-en-lost-query-hash",page.url());
    const storedEn=await page.evaluate(()=>({local:localStorage.getItem("openpq_lang"),cookie:document.cookie}));
    if(storedEn.local!=="en"||!storedEn.cookie.includes("openpq_lang=en"))fail("/en/weather/",390,"manual-en-not-persisted",JSON.stringify(storedEn));

    await page.goto(BASE+"/weather/?point=duong-dong#today",{waitUntil:"domcontentloaded",timeout:15000});
    await page.waitForURL(/\/en\/weather\//,{timeout:5000});
    if(!page.url().includes("point=duong-dong")||!page.url().endsWith("#today"))fail("/en/weather/",390,"remembered-en-lost-query-hash",page.url());

    await page.locator('[data-openpq-language-static] [data-openpq-lang="vi"]').click();
    await page.waitForURL(url=>url.pathname==="/weather/",{timeout:5000});
    await page.waitForTimeout(250);
    if(new URL(page.url()).pathname!=="/weather/")fail("/weather/",390,"manual-vi-bounced-back",page.url());
    const storedVi=await page.evaluate(()=>({local:localStorage.getItem("openpq_lang"),cookie:document.cookie}));
    if(storedVi.local!=="vi"||!storedVi.cookie.includes("openpq_lang=vi"))fail("/weather/",390,"manual-vi-not-persisted",JSON.stringify(storedVi));
  }catch(error){fail("/weather/",390,"preference-roundtrip-exception",String(error.message||error))}
  finally{await page.close();await context.close()}
}

await browser.close();
if(failures.length){console.error(JSON.stringify(failures,null,2));process.exit(1)}
console.log(`PASS browser i18n QA: ${staticRoutes.length} static shells + ${nativeRoutes.length} native shell; 4 viewports; safe detect + remembered VI/EN round-trip`);
