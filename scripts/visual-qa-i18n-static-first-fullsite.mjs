import {chromium} from "playwright";
import assert from "node:assert/strict";

const testBase=process.env.I18N_TEST_URL||"http://127.0.0.1:4190";
const baselineBase=process.env.I18N_BASELINE_URL||"http://127.0.0.1:4189";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const routes=["/","/weather/","/transit/","/guide/","/stories/","/food/","/go/","/nearme/","/explore/","/about/"];

const relevantI18n=paths=>paths.filter(x=>x==="/core/i18n-runtime.js"||x.startsWith("/data/i18n/")).sort();
async function load(base,path,width=390){
  const page=await browser.newPage({viewport:{width,height:844},deviceScaleFactor:1});
  const requests=[];
  page.on("request",req=>{try{requests.push(new URL(req.url()).pathname)}catch{}});
  const response=await page.goto(base+path,{waitUntil:"domcontentloaded",timeout:45000});
  assert.equal(response?.status(),200,`${path} must render from ${base}`);
  await page.waitForTimeout(300);
  return {page,requests};
}
async function inspect(path,width=390){
  const baseline=await load(baselineBase,path,width);
  const baselineI18n=relevantI18n(baseline.requests);
  await baseline.page.close();

  const tested=await load(testBase,path,width);
  const {page,requests}=tested;
  const state=await page.evaluate(()=>{
    const selector=document.querySelector("[data-openpq-static-language]");
    const r=selector?.getBoundingClientRect();
    const en=selector?.querySelector('a[data-lang="en"]');
    return {
      selectorCount:document.querySelectorAll("[data-openpq-static-language]").length,
      visible:!!r&&r.width>0&&r.height>0,
      selector:r?{left:r.left,right:r.right,top:r.top,bottom:r.bottom}:null,
      width:innerWidth,
      scrollWidth:document.documentElement.scrollWidth,
      enHref:en?.getAttribute("href")||"",
      router:!!window.OpenPQLocaleRouter
    };
  });
  assert.equal(state.selectorCount,1,`${path} must have exactly one selector owner`);
  assert.equal(state.visible,true,`${path} selector must be visible at first usable render`);
  assert.ok(state.selector.left>=-1&&state.selector.right<=state.width+1,`${path} selector must stay inside viewport`);
  assert.ok(state.scrollWidth<=state.width+2,`${path} must not gain horizontal overflow`);
  assert.equal(state.router,true,`${path} locale router must load`);
  assert.equal(requests.filter(x=>x==="/core/locale-router-static.js").length,1,`${path} router JS must load once`);
  assert.equal(requests.filter(x=>x==="/core/locale-router-static.css").length,1,`${path} selector CSS must load once`);
  assert.deepEqual(relevantI18n(requests),baselineI18n,`${path} selector must add zero legacy i18n/catalog requests versus untouched baseline`);
  await page.close();
  return state;
}

try{
  for(const route of routes)await inspect(route,390);
  await inspect("/",320);
  await inspect("/",1440);

  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.goto(testBase+"/guide/article.html?id=pepper&from=home#story",{waitUntil:"domcontentloaded",timeout:45000});
  await page.waitForTimeout(100);
  const routed=await page.evaluate(()=>window.OpenPQLocaleRouter.routeFor("en"));
  assert.equal(routed,"/en/guide/article.html?id=pepper&from=home#story","EN route must preserve article query and hash without ?lang redirect");
  const back=await page.evaluate(()=>window.OpenPQLocaleRouter.routeFor("vi",{pathname:"/en/guide/article.html",search:"?id=pepper&lang=en&from=home",hash:"#story"}));
  assert.equal(back,"/guide/article.html?id=pepper&from=home#story","VI route must strip locale prefix and obsolete lang query");
  await page.close();

  const baselineAirport=await load(baselineBase,"/airport/",390);
  const baselineAirportI18n=relevantI18n(baselineAirport.requests);
  await baselineAirport.page.close();
  const testedAirport=await load(testBase,"/airport/",390);
  const airport=testedAirport.page;
  assert.equal(await airport.locator("[data-openpq-static-language]").count(),0,"Airport must not receive a duplicate shared selector");
  assert.equal(await airport.locator("#languageSelect").count(),1,"Airport native selector must remain present");
  assert.equal(await airport.evaluate(()=>!!window.OpenPQLocaleRouter),true,"Airport may share the route contract without sharing selector UI");
  assert.deepEqual(relevantI18n(testedAirport.requests),baselineAirportI18n,"Airport router must add zero legacy i18n/catalog requests versus untouched baseline");
  await airport.close();

  console.log(`PASS browser static-first i18n: ${routes.length} route families + article query/hash + 320/390/1440 widths; zero incremental legacy i18n/catalog requests; Airport native-only`);
}finally{await browser.close()}
