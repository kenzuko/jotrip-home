import assert from "node:assert/strict";
import {mkdirSync} from "node:fs";
import {chromium} from "playwright";

const base=process.env.VISUAL_QA_BASE_URL||"http://127.0.0.1:4173";
mkdirSync("visual-qa-results",{recursive:true});
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});

function measurements(){
  const box=selector=>{
    const r=document.querySelector(selector)?.getBoundingClientRect();
    return r?{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom}:null;
  };
  return {
    viewport:innerWidth,
    overflow:document.documentElement.scrollWidth-innerWidth,
    layout:box(".near-layout"),
    map:box("#nearMap"),
    shell:box("#nearMapShell"),
    note:box("#nearMapShell .map-shell-note"),
    controls:box(".controls"),
    results:box(".results")
  };
}

try{
  for(const [width,height] of [[1024,768],[1366,900]]){
    const page=await browser.newPage({viewport:{width,height}});
    await page.goto(base+"/nearme/?area=zone_central_west",{waitUntil:"domcontentloaded",timeout:45000});
    await page.waitForFunction(()=>!document.querySelector("#nearMapShell")?.hidden,null,{timeout:15000});
    await page.waitForFunction(()=>document.querySelectorAll("#nearResults .near-card").length>0,null,{timeout:15000});
    const before=await page.evaluate(measurements);
    assert.ok(before.overflow<=3,width+"px: no horizontal scroll");
    assert.ok(before.map&&before.layout&&before.shell,width+"px: map workspace must exist");
    assert.ok(before.map.height>=380,width+"px: map must occupy most of right pane, not a narrow strip");
    assert.ok(Math.abs(before.shell.height-before.layout.height)<=8,width+"px: map should fill the workspace height");
    assert.ok(before.shell.height-before.map.height-(before.note?.height||0)<12,
      width+"px: no empty white space below the actual map");
    assert.ok(before.map.width>width*.36,width+"px: map should retain ample horizontal room");
    const scroller=width<1280?".near-workspace-left":".results";
    const scroll=await page.evaluate(sel=>{
      const el=document.querySelector(sel);
      const overflow=el.scrollHeight-el.clientHeight;
      el.scrollTop=Math.min(420,overflow);
      return {overflow,scrollTop:el.scrollTop};
    },scroller);
    assert.ok(scroll.overflow>200,width+"px: long list scrolls inside its own pane");
    await page.waitForTimeout(110);
    const after=await page.evaluate(measurements);
    assert.ok(Math.abs(before.shell.y-after.shell.y)<=4,width+"px: scrolling list must not move the map");
    assert.ok(Math.abs(before.map.height-after.map.height)<=4,width+"px: map height must remain stable");
    await page.screenshot({path:"visual-qa-results/nearme-workspace-"+width+".png",fullPage:false});
    console.log("NEAR ME WORKSPACE PASS",width,before.map.width.toFixed(0)+"x"+before.map.height.toFixed(0));
    await page.close();
  }
  {
    const page=await browser.newPage({viewport:{width:390,height:844}});
    await page.goto(base+"/nearme/?area=zone_central_west",{waitUntil:"domcontentloaded",timeout:45000});
    await page.waitForFunction(()=>document.querySelectorAll("#nearResults .near-card").length>0,null,{timeout:15000});
    assert.equal(await page.locator("#nearMapShell").isHidden(),true,"Mobile loads the list first");
    await page.locator("#nearMapToggle").click();
    await page.waitForFunction(()=>!document.querySelector("#nearMapShell")?.hidden,null,{timeout:15000});
    const view=await page.evaluate(measurements);
    assert.ok(view.map.height>=300,"Mobile map must be useful when opened");
    assert.ok(view.map.y<view.results.y,"The requested mobile map appears before the long list");
    assert.ok(view.overflow<=3,"Mobile has no horizontal scrolling");
    await page.screenshot({path:"visual-qa-results/nearme-workspace-390.png",fullPage:false});
    await page.close();
    console.log("NEAR ME MOBILE MAP PASS");
  }
  {
    const page=await browser.newPage({viewport:{width:1366,height:900}});
    await page.goto(base+"/",{waitUntil:"domcontentloaded",timeout:45000});
    const fuel=page.locator('#nearCategories [data-category="FUEL"]');
    await fuel.waitFor({state:"attached",timeout:10000});
    await fuel.click();
    await page.waitForFunction(()=>
      document.querySelector('[data-near-handoff]')?.getAttribute("href")?.includes("category=FUEL"),
      null,{timeout:10000});
    await page.waitForFunction(()=>document.querySelectorAll("#nearResults .near-result-card").length>0,
      null,{timeout:10000});
    const card=page.locator("#nearResults .near-result-card").first();
    const href=await card.locator('a[href^="nearme/?"]').first().getAttribute("href");
    assert.ok(href?.includes("category=FUEL")&&href?.includes("q="),
      "Homepage result opens own map with the selected category and place");
    assert.ok((await page.locator("#nearQuickResultsTitle").textContent()).includes("Cây xăng"),
      "Homepage uses a context-aware results title");
    await page.screenshot({path:"visual-qa-results/nearme-homepage-1366.png",fullPage:false});
    await page.close();
    console.log("HOMEPAGE NEAR ME HANDOFF PASS");
  }
}finally{
  await browser.close();
}
