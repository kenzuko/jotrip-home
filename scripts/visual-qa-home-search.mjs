import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const base=process.env.VISUAL_QA_BASE_URL||"http://127.0.0.1:4173";
await fs.mkdir("visual-qa-results",{recursive:true});
const browser=await chromium.launch({headless:true});
try {
  for(const [width,height] of [[390,650],[390,450],[430,500]]){
    const page=await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true,deviceScaleFactor:2});
    await page.goto(base+"/",{waitUntil:"domcontentloaded"});
    const input=page.locator("#q");
    await input.scrollIntoViewIfNeeded();
    await input.fill("nhà thùng");
    await page.waitForSelector("#searchResults:not([hidden]) .search-result",{timeout:12000});
    // Model the reduced visible space while the iOS / Facebook keyboard is up.
    await page.setViewportSize({width,height:height-90});
    await page.evaluate(()=>window.syncMobileSearch?.());
    await page.waitForTimeout(280);
    const pos=await page.evaluate(()=>{
      const form=document.querySelector(".search"),input=document.querySelector("#q");
      const results=document.querySelector("#searchResults"),hero=document.querySelector(".hero");
      const a=form.getBoundingClientRect(),b=results.getBoundingClientRect(),c=input.getBoundingClientRect();
      const view=window.visualViewport?.height||window.innerHeight;
      const computed=getComputedStyle(results);
      return {formTop:a.top,formBottom:a.bottom,fieldTop:c.top,fieldBottom:c.bottom,
        panelTop:b.top,panelBottom:b.bottom,visualHeight:view,panelPosition:computed.position,
        active:hero.classList.contains("search-focused"),count:results.querySelectorAll(".search-result").length};
    });
    assert.ok(pos.active&&pos.count>0,"Search must stay active while suggestions are visible");
    assert.equal(pos.panelPosition,"absolute","Suggestions anchored to form, never fixed to keyboard");
    assert.ok(pos.fieldTop>=-2&&pos.fieldBottom<=pos.visualHeight+2,
      "Typed text must remain within the visible viewport: "+JSON.stringify(pos));
    assert.ok(pos.panelTop>=pos.formBottom-2,
      "Suggestions must not cover input: "+JSON.stringify(pos));
    assert.ok(pos.panelBottom<=pos.visualHeight+4,
      "Suggestions must fit above simulated keyboard: "+JSON.stringify(pos));
    await page.screenshot({path:"visual-qa-results/home-search-"+width+"x"+(height-90)+".png"});
    await input.press("Escape");
    await page.waitForFunction(()=>document.querySelector("#searchResults").hidden);
    assert.equal(await page.locator(".hero.search-focused").count(),0,"Escape closes search focus");
    console.log("Keyboard-safe search passed",width+"x"+(height-90),JSON.stringify(pos));
    await page.close();
  }
}finally{await browser.close();}
