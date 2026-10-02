import {chromium} from "playwright";
import assert from "node:assert/strict";

const base=process.env.VISUAL_QA_BASE_URL||"http://127.0.0.1:4188";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});

async function load(path,viewport){
  const page=await browser.newPage({viewport,deviceScaleFactor:1});
  const requests=[];
  page.on("request",req=>requests.push(new URL(req.url()).pathname));
  await page.goto(base+path,{waitUntil:"domcontentloaded",timeout:45000});
  await page.waitForTimeout(120);
  return {page,requests};
}

try{
  {
    const {page,requests}=await load("/?qa=selector#today",{width:320,height:680});
    const metrics=await page.evaluate(()=>{
      const rect=s=>{const r=document.querySelector(s)?.getBoundingClientRect();return r&&{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
      const selector=document.querySelector("[data-language-slot]");
      const selectorRect=selector?.getBoundingClientRect();
      return {
        scrollWidth:document.documentElement.scrollWidth,width:innerWidth,
        logo:rect(".site-header .brand"),area:rect("#siteAreaButton"),search:rect(".header-search"),menu:rect(".menu-button"),
        selectorVisible:!!selectorRect&&selectorRect.width>0&&selectorRect.height>0&&getComputedStyle(selector).visibility!=="hidden",
        selectorParent:selector?.parentElement?.id||""
      };
    });
    assert.ok(metrics.scrollWidth<=metrics.width+2,"320px homepage must not overflow horizontally");
    assert.ok(metrics.logo.right<=metrics.area.left+2&&metrics.area.right<=metrics.search.left+2&&metrics.search.right<=metrics.menu.left+2,
      "selector must not disturb the existing narrow homepage header row: "+JSON.stringify(metrics));
    assert.equal(metrics.selectorParent,"primary-nav","mobile selector must live in the existing menu flow");
    assert.equal(metrics.selectorVisible,false,"closed mobile menu must not expose or reserve selector space");
    assert.equal(requests.filter(x=>x==="/core/language-switcher.js").length,1,"VI homepage loads selector runtime once");
    assert.equal(requests.filter(x=>x==="/core/i18n-runtime.js").length,0,"VI homepage must not load i18n runtime just to draw selector");
    assert.equal(requests.filter(x=>x.includes("/data/i18n/catalog")).length,0,"VI homepage selector must not fetch locale catalog");
    await page.locator(".menu-button").click();
    await page.waitForTimeout(80);
    const open=await page.evaluate(()=>{
      const nav=document.querySelector("#primary-nav"),sel=document.querySelector("[data-language-slot]");
      const r=sel?.getBoundingClientRect();
      return {open:nav?.classList.contains("open"),visible:!!r&&r.width>0&&r.height>0,left:r?.left,right:r?.right,width:innerWidth};
    });
    assert.equal(open.open,true,"mobile menu must open normally");
    assert.equal(open.visible,true,"selector must be available inside open mobile menu");
    assert.ok(open.left>=0&&open.right<=open.width+1,"selector must stay inside mobile viewport");
    const enHref=await page.locator('[data-language-slot] a[data-lang="en"]').getAttribute("href");
    assert.match(enHref,/^\/en\/\?qa=selector&lang=en#today$|^\/en\/\?lang=en&qa=selector#today$/,"selector must preserve non-language query and hash while marking manual EN choice");
    await page.close();
  }

  {
    const {page}=await load("/",{width:1440,height:900});
    assert.equal(await page.locator("[data-language-slot]").count(),1,"desktop homepage selector must exist exactly once");
    const box=await page.locator("[data-language-slot]").boundingBox();
    assert.ok(box&&box.width>0&&box.height>0,"desktop homepage selector must be visible");
    assert.ok((await page.evaluate(()=>document.documentElement.scrollWidth))<=1442,"desktop homepage must not overflow horizontally");
    await page.close();
  }

  for(const path of ["/weather/","/transit/"]){
    const {page,requests}=await load(path,{width:390,height:844});
    assert.equal(await page.locator("[data-language-slot]").count(),1,path+" must contain exactly one shared selector");
    const state=await page.evaluate(()=>{
      const sel=document.querySelector("[data-language-slot]")?.getBoundingClientRect();
      const header=document.querySelector("header")?.getBoundingClientRect();
      return {scrollWidth:document.documentElement.scrollWidth,width:innerWidth,sel:sel&&{left:sel.left,right:sel.right,top:sel.top,bottom:sel.bottom},header:header&&{left:header.left,right:header.right,top:header.top,bottom:header.bottom}};
    });
    assert.ok(state.scrollWidth<=state.width+2,path+" must not gain horizontal scrolling from selector: "+JSON.stringify(state));
    assert.ok(state.sel&&state.sel.left>=-1&&state.sel.right<=state.width+1,path+" selector must stay in viewport");
    assert.equal(requests.filter(x=>x==="/core/i18n-runtime.js").length,0,path+" VI fast path must not load i18n runtime for selector");
    await page.close();
  }

  {
    const {page}=await load("/airport/",{width:390,height:844});
    assert.equal(await page.locator("[data-language-slot]").count(),0,"Airport must not receive duplicate shared selector");
    assert.equal(await page.locator("#languageSelect").count(),1,"Airport native selector must remain intact");
    await page.close();
  }

  console.log("PASS browser selector safety: 320px header preserved, mobile-menu placement, desktop visibility, Weather/Transit no overflow, Airport native-only, VI no i18n-runtime/catalog fetch");
}finally{
  await browser.close();
}
