import {chromium} from "playwright";
import assert from "node:assert/strict";

const base=process.env.I18N_TEST_URL||"http://127.0.0.1:4190";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const routes=["/","/weather/","/transit/","/guide/","/stories/","/food/","/go/","/nearme/","/explore/","/about/"];

async function inspect(path,width=390){
  const page=await browser.newPage({viewport:{width,height:844},deviceScaleFactor:1});
  const requests=[];
  page.on("request",req=>{try{requests.push(new URL(req.url()).pathname)}catch{}});
  const response=await page.goto(base+path,{waitUntil:"domcontentloaded",timeout:45000});
  assert.equal(response?.status(),200,`${path} must render in isolated static bundle`);
  await page.waitForTimeout(250);
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
  assert.equal(requests.filter(x=>x==="/core/i18n-runtime.js").length,0,`${path} VI selector must not load legacy i18n runtime`);
  assert.equal(requests.filter(x=>x.includes("/data/i18n/catalog")).length,0,`${path} VI selector must not fetch locale catalog`);
  await page.close();
  return state;
}

try{
  for(const route of routes)await inspect(route,390);
  await inspect("/",320);
  await inspect("/",1440);

  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.goto(base+"/guide/article.html?id=pepper&from=home#story",{waitUntil:"domcontentloaded",timeout:45000});
  await page.waitForTimeout(100);
  const routed=await page.evaluate(()=>window.OpenPQLocaleRouter.routeFor("en"));
  assert.equal(routed,"/en/guide/article.html?id=pepper&from=home#story","EN route must preserve article query and hash without ?lang redirect");
  const back=await page.evaluate(()=>window.OpenPQLocaleRouter.routeFor("vi",{pathname:"/en/guide/article.html",search:"?id=pepper&lang=en&from=home",hash:"#story"}));
  assert.equal(back,"/guide/article.html?id=pepper&from=home#story","VI route must strip locale prefix and obsolete lang query");
  await page.close();

  const airport=await browser.newPage({viewport:{width:390,height:844}});
  await airport.goto(base+"/airport/",{waitUntil:"domcontentloaded",timeout:45000});
  assert.equal(await airport.locator("[data-openpq-static-language]").count(),0,"Airport must not receive a duplicate shared selector");
  assert.equal(await airport.locator("#languageSelect").count(),1,"Airport native selector must remain present");
  assert.equal(await airport.evaluate(()=>!!window.OpenPQLocaleRouter),true,"Airport may share the route contract without sharing selector UI");
  await airport.close();

  console.log(`PASS browser static-first i18n: ${routes.length} route families + article query/hash + 320/390/1440 widths; no catalog fetch, no legacy i18n runtime on VI, Airport native-only`);
}finally{await browser.close()}
