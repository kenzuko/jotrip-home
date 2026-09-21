import { chromium } from "playwright";
const base=process.env.NEAR_ME_BASE_URL||"http://127.0.0.1:4173";
const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext({viewport:{width:390,height:844},locale:"vi-VN",timezoneId:"Asia/Ho_Chi_Minh"});
  const page=await context.newPage();
  const geoCalls=[];
  await page.addInitScript(() => {
    const original=navigator.geolocation?.getCurrentPosition?.bind(navigator.geolocation);
    if(navigator.geolocation&&original){
      navigator.geolocation.getCurrentPosition=(...args)=>{
        window.__nearMeGeoCalls=(window.__nearMeGeoCalls||0)+1;
        return original(...args);
      };
    }
  });
  await page.goto(base+"/",{waitUntil:"domcontentloaded"});
  await page.waitForLoadState("networkidle",{timeout:5000}).catch(()=>{});
  await page.waitForSelector('[data-category="PHARMACY"]',{timeout:10000});
  const initialGeo=await page.evaluate(()=>window.__nearMeGeoCalls||0);
  if(initialGeo!==0) throw new Error("Near Me requested geolocation on page load");

  await page.click('[data-category="PHARMACY"]');
  await page.click('[data-area="zone_central_west"]');
  await page.waitForTimeout(100);
  let cards=page.locator(".near-result-card");
  let count=await cards.count();
  if(count<2) throw new Error("Expected at least 2 Dương Đông pharmacy cards, got "+count);
  let text=await page.locator("#nearResults").innerText();
  if(!text.includes("42 Trần Phú")||!text.includes("327 Nguyễn Trung Trực")) throw new Error("Dương Đông pharmacy canonical addresses missing");

  await page.click('[data-category="CLINIC_HOSPITAL"]');
  await page.click('[data-area="zone_central_west"]');
  await page.waitForTimeout(100);
  text=await page.locator("#nearResults").innerText();
  if(!text.includes("Vinmec Dương Đông")) throw new Error("Dương Đông clinic missing");

  await page.click('[data-area="zone_north"]');
  await page.waitForTimeout(100);
  text=await page.locator("#nearResults").innerText();
  if(!text.includes("Bệnh viện Vinmec Phú Quốc")||!text.includes("24/24")) throw new Error("North hospital or emergency note missing");

  console.log("Near Me interaction OK");
  await context.close();
}finally{await browser.close()}
