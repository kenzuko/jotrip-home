import {chromium} from "playwright";

const BASE=process.env.VISUAL_QA_BASE_URL||"http://127.0.0.1:4173";
const ORIGIN=new URL(BASE).origin;
const browser=await chromium.launch({headless:true});
const failures=[];
const fail=(reason,detail="")=>failures.push({route:"/airport/",reason,detail});

async function blockExternal(context){
  await context.route("**/*",async route=>{
    try{if(new URL(route.request().url()).origin===ORIGIN)return route.fallback()}catch{}
    return route.abort();
  });
}
async function workerlessEnglishFulfill(context){
  await context.route(/\/en(?:\/|$)/,async route=>{
    const u=new URL(route.request().url());
    const basePath=u.pathname.replace(/^\/en(?=\/|$)/,"")||"/";
    const source=await fetch(BASE+basePath+u.search);
    if(!source.ok)return route.fulfill({status:source.status,body:await source.text()});
    let html=await source.text();
    html=html.replace(/<html([^>]*)lang=["'][^"']+["']([^>]*)>/i,'<html$1lang="en"$2>');
    html=html.replace(/<head>/i,'<head><meta name="openpq-locale" content="en"><script src="/core/i18n-runtime.js?v=4" defer></script><script src="/core/en-full-site.js?v=2" defer></script><script src="/core/language-switcher.js?v=4" defer></script>');
    html=html.replace(/(<body[^>]*>)/i,'$1<nav class="opq-language-auto" data-openpq-language-switcher-auto data-openpq-language-switcher-server aria-label="Language"><div class="opq-language-options"><a href="/airport/?lang=vi">VI</a><a href="/en/airport/?lang=en">EN</a></div></nav>');
    await route.fulfill({status:200,contentType:"text/html; charset=utf-8",body:html});
  });
}

// EN device language routes Airport to canonical /en/airport/ without writing
// a manual preference. The native dropdown remains the only visible selector.
{
  const context=await browser.newContext({viewport:{width:390,height:844},locale:"en-US",serviceWorkers:"block"});
  await blockExternal(context);await workerlessEnglishFulfill(context);
  const page=await context.newPage();page.setDefaultTimeout(4000);
  try{
    await page.goto(BASE+"/airport/?flight=VN123#board",{waitUntil:"domcontentloaded",timeout:10000});
    await page.waitForURL(/\/en\/airport\//,{timeout:5000});
    const u=new URL(page.url());
    if(u.searchParams.get("flight")!=="VN123"||u.hash!=="#board")fail("airport-device-en-lost-query-hash",page.url());
    await page.waitForFunction(()=>document.querySelector('#languageSelect')?.value==='en',{timeout:5000});
    const state=await page.evaluate(()=>({
      native:document.querySelectorAll('#languageSelect').length,
      common:document.querySelectorAll('[data-openpq-language-static]').length,
      legacyVisible:[...document.querySelectorAll('.opq-language-auto')].filter(x=>getComputedStyle(x).display!=="none").length,
      global:localStorage.getItem('openpq_lang')||'',
      airport:localStorage.getItem('jotrip_airport_lang')||'',
      cookie:document.cookie
    }));
    if(state.native!==1||state.common!==0||state.legacyVisible!==0)fail("airport-selector-duplication",JSON.stringify(state));
    if(state.global||state.airport||state.cookie.includes("openpq_lang="))fail("airport-autodetect-wrote-manual-preference",JSON.stringify(state));

    await page.locator('#languageSelect').selectOption('vi');
    await page.waitForURL(url=>url.pathname==="/airport/",{timeout:5000});
    const afterVi=await page.evaluate(()=>({global:localStorage.getItem('openpq_lang'),airport:localStorage.getItem('jotrip_airport_lang'),cookie:document.cookie}));
    if(afterVi.global!=="vi"||afterVi.airport!=="vi"||!afterVi.cookie.includes("openpq_lang=vi"))fail("airport-manual-vi-not-persisted",JSON.stringify(afterVi));
  }catch(error){fail("airport-en-roundtrip-exception",String(error.message||error))}
  finally{await page.close();await context.close()}
}

// Legacy ?lang links are canonicalized client-side while preserving unrelated
// query parameters and hash; no VI Worker-first route is required.
{
  const context=await browser.newContext({viewport:{width:390,height:844},locale:"vi-VN",serviceWorkers:"block"});
  await blockExternal(context);await workerlessEnglishFulfill(context);
  const page=await context.newPage();page.setDefaultTimeout(4000);
  try{
    await page.goto(BASE+"/airport/?lang=en&flight=VN123#board",{waitUntil:"domcontentloaded",timeout:10000});
    await page.waitForURL(/\/en\/airport\//,{timeout:5000});
    const u=new URL(page.url());
    if(u.searchParams.has("lang")||u.searchParams.get("flight")!=="VN123"||u.hash!=="#board")fail("airport-legacy-lang-not-canonicalized",page.url());
    const stored=await page.evaluate(()=>({global:localStorage.getItem('openpq_lang'),airport:localStorage.getItem('jotrip_airport_lang')}));
    if(stored.global!=="en"||stored.airport!=="en")fail("airport-legacy-en-not-persisted",JSON.stringify(stored));
  }catch(error){fail("airport-legacy-exception",String(error.message||error))}
  finally{await page.close();await context.close()}
}

// Airport-only KO/RU/ZH remain native. Choosing KO from an EN URL returns to
// the unprefixed Airport shell and persists only the Airport-specific locale.
{
  const context=await browser.newContext({viewport:{width:390,height:844},locale:"en-US",serviceWorkers:"block"});
  await blockExternal(context);await workerlessEnglishFulfill(context);
  const page=await context.newPage();page.setDefaultTimeout(4000);
  try{
    await page.goto(BASE+"/en/airport/",{waitUntil:"domcontentloaded",timeout:10000});
    await page.waitForFunction(()=>document.querySelector('#languageSelect')?.value==='en',{timeout:5000});
    await page.locator('#languageSelect').selectOption('ko');
    await page.waitForURL(url=>url.pathname==="/airport/",{timeout:5000});
    await page.waitForFunction(()=>document.querySelector('#languageSelect')?.value==='ko',{timeout:5000});
    const stored=await page.evaluate(()=>({global:localStorage.getItem('openpq_lang')||'',airport:localStorage.getItem('jotrip_airport_lang')||''}));
    if(stored.airport!=="ko")fail("airport-ko-not-persisted",JSON.stringify(stored));
    if(stored.global)fail("airport-local-ko-leaked-global-preference",JSON.stringify(stored));
  }catch(error){fail("airport-local-locale-exception",String(error.message||error))}
  finally{await page.close();await context.close()}
}

await browser.close();
if(failures.length){console.error(JSON.stringify(failures,null,2));process.exit(1)}
console.log("PASS Airport i18n QA: native selector only; device EN canonical route; VI/EN global preference; legacy links; KO local persistence");
