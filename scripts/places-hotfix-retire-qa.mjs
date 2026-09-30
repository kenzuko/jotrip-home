// Exact approved Places release: verify the canonical Worker and public route
// render identical user-visible cards before/after removing the temporary route.
import {chromium} from "playwright";
const base=String(process.env.PLACES_QA_BASE_URL||"").replace(/\/$/,"");
if(!base.startsWith("https://"))throw Error("PLACES_QA_BASE_URL must be an HTTPS origin");
const browser=await chromium.launch({headless:true});
try{
  for(const width of [390,768,1440]){
    const page=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:1});
    await page.goto(base+"/places/",{waitUntil:"domcontentloaded",timeout:30000});
    await page.locator(".place-card").first().waitFor({timeout:40000});
    const n=await page.locator(".place-card").count();
    if(n!==39)throw Error(base+" "+width+": expected 39 verified places, got "+n);
    const cols=await page.locator("#placeCards").evaluate(el=>
      getComputedStyle(el).gridTemplateColumns.split(" ").length);
    if(width===1440&&cols!==2||width<=768&&cols!==1)
      throw Error(base+" "+width+": wrong grid columns "+cols);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+4);
    if(overflow)throw Error(base+" "+width+": horizontal overflow");
    await page.locator(".place-more summary").first().click();
    if(!await page.locator(".place-more[open]").count())
      throw Error(base+" "+width+": detail expander unavailable");
    await page.close();
  }
  const page=await browser.newPage();
  await page.goto(base+"/places/",{waitUntil:"domcontentloaded",timeout:30000});
  await page.locator(".place-card").first().waitFor({timeout:40000});
  await page.locator("#placeSearch").fill("Safari");
  if(await page.locator(".place-card").count()!==1)
    throw Error(base+": Safari filter returned unexpected cards");
  await page.close();
  console.log("Places canonical QA PASS: 39 cards, 3 viewports, grid, expanders, search: "+base);
}finally{await browser.close();}
