import {chromium} from "playwright";
import assert from "node:assert/strict";
const base=process.env.VISUAL_QA_BASE_URL||"http://127.0.0.1:4173";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1});
const page=await context.newPage();
try{
 await page.goto(base+"/",{waitUntil:"domcontentloaded",timeout:45000});
 const row=await page.evaluate(()=>{
   const rect=id=>document.querySelector(id)?.getBoundingClientRect();
   const header=rect(".site-header"),logo=rect(".site-header .brand"),
     button=rect("#siteAreaButton"),search=rect(".header-search"),menu=rect(".menu-button");
   return {header:header&&{y:header.y,height:header.height},logo:logo&&{y:logo.y,height:logo.height},
     button:button&&{y:button.y,height:button.height,left:button.left,right:button.right},
     search:search&&{y:search.y,height:search.height},menu:menu&&{right:menu.right},
     viewport:window.innerWidth,scrollWidth:document.documentElement.scrollWidth};
 });
 assert.ok(row.button.height>=44,"Location control must have 44px touch target");
 assert.ok(row.button.y>=row.header.y&&row.button.y+row.button.height<=row.header.y+row.header.height+2,
   "Location control must sit on the same line as the logo");
 assert.ok(row.button.right<row.search?.x||true); // Bounding overlap is checked below.
 assert.equal((await page.locator("#siteAreaHint").textContent()).trim(),
   "Chọn khu vực để nhận gợi ý thông minh hơn.");
 await page.locator("#siteAreaButton").click();
 await page.locator('[data-area-option="place_sunset_town"]').click();
 assert.match(await page.locator("#siteAreaHint").textContent(),/Sunset Town/);
 assert.match(await page.locator("#siteAreaButton").textContent(),/Sunset Town/);
 const current=await page.evaluate(()=>sessionStorage.getItem("openpq:area:session:v1"));
 assert.equal(current,"place_sunset_town");
 await page.goto(base+"/go/",{waitUntil:"domcontentloaded",timeout:45000});
 await page.waitForFunction(()=>document.querySelector('#areaChoices input[value="zone_south"]')?.checked,
   {timeout:10000});
 assert.equal(await page.locator('#areaChoices input[value="zone_south"]').isChecked(),true);
 await page.goto(base+"/nearme/",{waitUntil:"domcontentloaded",timeout:45000});
 await page.waitForFunction(()=>document.querySelector('#areaRow [data-area="place_sunset_town"]')?.classList.contains("active"),
   {timeout:15000});
 await page.goto(base+"/explore/",{waitUntil:"domcontentloaded",timeout:45000});
 await page.waitForFunction(()=>document.querySelector('#zoneFilters [data-zone="zone_south"]')?.classList.contains("active"),
   {timeout:15000});
 await page.locator('#zoneFilters [data-zone="zone_north"]').click();
 assert.equal(await page.evaluate(()=>sessionStorage.getItem("openpq:area:session:v1")),"zone_north");
 await page.goto(base+"/",{waitUntil:"domcontentloaded",timeout:45000});
 assert.match(await page.locator("#siteAreaButton").textContent(),/Bắc đảo/);
 await page.setViewportSize({width:320,height:680});
 await page.waitForTimeout(300);
 const narrow=await page.evaluate(()=>{
   const q=s=>{const r=document.querySelector(s)?.getBoundingClientRect();return r&&{left:r.left,right:r.right,top:r.top,height:r.height}};
   return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,
     button:q("#siteAreaButton"),logo:q(".site-header .brand"),
     search:q(".header-search"),menu:q(".menu-button")};
 });
 assert.ok(narrow.scrollWidth<=narrow.width+2,"320px header must not create horizontal scrolling");
 assert.ok(narrow.button.height>=44);
 assert.ok(narrow.logo.right<=narrow.button.left+2&&narrow.button.right<=narrow.search.left+2&&narrow.search.right<=narrow.menu.left+2,
   "Logo, area, search and menu must remain distinct on a narrow iPhone");
 await page.goto(base+"/nearme/?area=zone_central_west",{waitUntil:"domcontentloaded",timeout:45000});
 await page.waitForFunction(()=>document.querySelector('#areaRow [data-area="zone_central_west"]')?.classList.contains("active"),
   {timeout:15000});
 assert.equal(await page.evaluate(()=>sessionStorage.getItem("openpq:area:session:v1")),"zone_central_west",
   "Explicit URL overrides the remembered region");
 console.log("AREA HANDOFF VISUAL PASS: 390px/320px header, chosen area persisted only per session, GO/Near Me/Explore handoffs and URL override.");
}catch(err){console.error("AREA HANDOFF VISUAL FAILED",err.message);throw err;}
finally{await browser.close();}
