import {chromium} from "playwright";

const base=(process.env.OPENPQ_BASE||"https://openphuquoc.com").replace(/\/$/,"");
const result={ok:false,home:null,weather:null,requests:[],errors:[]};
const browser=await chromium.launch({headless:true});

function badPublicText(text){
  return /\b(?:BETA|OBSERVATION|NOWCAST|PUBLIC_BETA|DERIVED_NOWCAST|REMOTE_OBSERVED|ACTUAL|V2)\b/i.test(String(text||""));
}

try{
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
  page.on("pageerror",e=>result.errors.push("page: "+String(e)));
  page.on("request",req=>{
    const u=req.url();
    if(/weather\/data\/(?:critical|local-now|nowcast-compact)\.json/i.test(u)||/raw\.githubusercontent\.com/i.test(u))
      result.requests.push(u);
  });
  await page.goto(base+"/?weather-final="+Date.now(),{waitUntil:"domcontentloaded",timeout:120000});
  await page.locator('[data-live="weather"]').waitFor({state:"visible",timeout:45000});
  await page.waitForTimeout(3500);
  const homeText=(await page.locator('[data-live="weather"]').innerText()).trim();
  const rawWeatherRequests=result.requests.filter(x=>
    /raw\.githubusercontent\.com\/kenzuko\/Jotrip-Lab\/(?:gh-pages\/weather\/data\/critical\.json|data-weather\/data\/weather-nowcast\/compact-latest\.json)/i.test(x)
  );
  const canonicalCritical=result.requests.some(x=>x.startsWith(base+"/weather/data/critical.json"));
  const canonicalLocalNow=result.requests.some(x=>x.startsWith(base+"/weather/data/local-now.json"));
  const canonicalNowcast=result.requests.some(x=>x.startsWith(base+"/weather/data/nowcast-compact.json"));
  result.home={text:homeText,canonicalCritical,canonicalLocalNow,canonicalNowcast,rawWeatherRequests};
  if(rawWeatherRequests.length)throw new Error("Homepage still requests raw GitHub Weather data");
  if(!canonicalCritical||!canonicalLocalNow||!canonicalNowcast)
    throw new Error("Homepage did not request canonical critical + Local Now + nowcast feeds");
  if(/\bLIVE\b/.test(homeText))throw new Error("Homepage Weather card exposes raw LIVE label");
  if(badPublicText(homeText))throw new Error("Homepage Weather card exposes machine label: "+homeText);

  await page.goto(base+"/weather/?weather-final="+Date.now(),{waitUntil:"domcontentloaded",timeout:120000});
  const panel=page.locator("#v3ObservationPanel");
  await panel.waitFor({state:"visible",timeout:45000});
  await page.waitForFunction(()=>{
    const p=document.getElementById("v3ObservationPanel");
    return p&&!p.hidden&&(document.getElementById("v3NowTitle")?.textContent||"").trim().length>0;
  },null,{timeout:45000});
  const humanHeadline=(await page.locator("#placeName").innerText()).trim();
  const humanSituation=(await page.locator("#heroCondition").innerText()).trim();
  if(!/· (?:khoảng \d+°C|đang cập nhật)/i.test(humanHeadline))
    throw new Error("Canonical Weather is not showing the Human Layer headline: "+humanHeadline);
  if(!humanSituation)throw new Error("Canonical Weather Human Layer situation is empty");
  await panel.evaluate(el=>{if(el instanceof HTMLDetailsElement)el.open=true});
  await page.waitForTimeout(150);
  const panelText=(await panel.innerText()).trim();
  const box=await panel.boundingBox();
  const nowEvidence=(await page.locator("#v3NowEvidence").innerText()).trim();
  const soonEvidence=(await page.locator("#v3SoonEvidence").innerText()).trim();
  const soonTitle=(await page.locator("#v3SoonTitle").innerText()).trim();
  const versionBadge=(await page.locator(".weather-version-badge").innerText()).trim();

  const nowcast=await page.evaluate(async()=>{
    const r=await fetch("/weather/data/nowcast-compact.json?t="+Date.now(),{cache:"no-store"});
    return r.json();
  });
  const sampled=Date.parse(nowcast?.sampled_time||"");
  const cloudAgeMin=Number.isFinite(sampled)?Math.max(0,(Date.now()-sampled)/60000):null;

  const anThoi=page.locator('#pointTabs button[data-point="an_thoi"]');
  await anThoi.waitFor({state:"visible",timeout:45000});
  await anThoi.click();
  await page.waitForFunction(()=>/An Thới/.test(document.getElementById("v3PointLabel")?.textContent||""),null,{timeout:10000});
  const pointAfterSwitch=(await page.locator("#v3PointLabel").innerText()).trim();

  result.weather={humanHeadline,humanSituation,panelText,width:box?.width||0,viewportWidth:390,nowEvidence,soonEvidence,soonTitle,cloudAgeMin,pointAfterSwitch,versionBadge};
  if(!box||box.width>390)throw new Error("Weather short-term panel overflows mobile viewport");
  if(badPublicText(panelText))throw new Error("Weather panel exposes machine/internal wording: "+panelText);
  if(!["SỐ ĐO THỰC TẾ","QUAN TRẮC SÂN BAY","CHƯA CÓ SỐ ĐO"].includes(nowEvidence))throw new Error("Unexpected current evidence label: "+nowEvidence);
  if(!["DIỄN BIẾN MÂY","ẢNH VỆ TINH"].includes(soonEvidence))throw new Error("Unexpected short-term evidence label: "+soonEvidence);
  if(versionBadge!=="V3")throw new Error("Canonical Weather does not expose the V3 badge");
  if(!/An Thới/.test(pointAfterSwitch))throw new Error("Weather panel did not follow point switch");
  if(cloudAgeMin!==null&&cloudAgeMin>60&&/tiến gần|đi ngang|dịch ra xa/i.test(soonTitle))
    throw new Error("Stale Himawari data still drives motion wording at "+cloudAgeMin.toFixed(1)+" min");
  if(result.errors.length)throw new Error("Page errors: "+result.errors.join(" | "));
  result.ok=true;
}catch(e){
  result.failure=String(e?.stack||e);
}finally{
  console.log(JSON.stringify(result,null,2));
  await browser.close();
}
if(!result.ok)process.exitCode=1;
