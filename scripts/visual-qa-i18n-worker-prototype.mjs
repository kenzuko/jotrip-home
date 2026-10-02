import {chromium,request as playwrightRequest} from "playwright";
import assert from "node:assert/strict";

const base=process.env.VISUAL_QA_WORKER_URL||"http://127.0.0.1:8790";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});

async function inspect(path,{slots,native=false,switcherRequests=1}={}){
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
  const requests=[];
  page.on("request",req=>requests.push(new URL(req.url()).pathname));
  const response=await page.goto(base+path,{waitUntil:"domcontentloaded",timeout:45000});
  assert.equal(response?.status(),200,path+" must resolve through local Worker");
  await page.waitForTimeout(180);
  const state=await page.evaluate(()=>({lang:document.documentElement.lang,locale:document.querySelector('meta[name="openpq-locale"]')?.content||"",shellSlots:document.querySelectorAll("[data-language-slot]").length,serverSelectors:document.querySelectorAll("[data-openpq-language-switcher-server]").length,nativeSelectors:document.querySelectorAll("#languageSelect").length,scrollWidth:document.documentElement.scrollWidth,width:innerWidth}));
  assert.ok(state.lang.toLowerCase().startsWith("en"),path+" must be marked English at HTML level");
  assert.equal(state.locale,"en",path+" must expose edge locale metadata");
  assert.equal(state.serverSelectors,0,path+" must not receive a duplicate edge selector when shell owns language control");
  assert.equal(state.shellSlots,slots,path+" shell selector count mismatch");assert.equal(state.nativeSelectors,native?1:0,path+" native selector ownership mismatch");assert.ok(state.scrollWidth<=state.width+2,path+" must not overflow horizontally after Worker rewrite");
  assert.equal(requests.filter(x=>x==="/core/language-switcher.js").length,switcherRequests,path+" shared selector runtime request count mismatch");assert.equal(requests.filter(x=>x==="/core/i18n-runtime.js").length,1,path+" must load i18n runtime exactly once");assert.equal(requests.filter(x=>x==="/core/en-full-site.js").length,1,path+" must load English presentation layer exactly once");
  await page.close();
}

try{
  await inspect("/en/",{slots:3});await inspect("/en/weather/",{slots:1});await inspect("/en/transit/",{slots:1});await inspect("/en/airport/",{slots:0,native:true,switcherRequests:0});
  const page=await browser.newPage({viewport:{width:390,height:844}});const guideResponse=await page.goto(base+"/en/guide/",{waitUntil:"domcontentloaded",timeout:45000});assert.equal(guideResponse?.status(),200,"non-shell English route must remain available");assert.equal(await page.locator("[data-openpq-language-switcher-server]").count(),1,"non-shell route must retain edge fallback selector");await page.close();
  const api=await playwrightRequest.newContext({baseURL:base});const manual=await api.get("/en/weather/?lang=en&point=duong-dong",{maxRedirects:0});assert.equal(manual.status(),302,"explicit EN choice must pass through Worker preference redirect");assert.match(manual.headers()["location"]||"",/\/en\/weather\/\?point=duong-dong$/,"manual preference redirect must preserve non-language query state");assert.match(manual.headers()["set-cookie"]||"",/openpq_lang=en/,"manual EN choice must persist first-party preference");await api.dispose();
  console.log("PASS local Worker i18n integration: responsive shell selectors deduplicated, Airport native-only, fallback routes preserved, manual preference cookie/query contract intact");
}finally{await browser.close()}
