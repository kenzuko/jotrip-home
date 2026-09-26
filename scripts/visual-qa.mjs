import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = process.env.VISUAL_QA_BASE_URL || 'http://127.0.0.1:4173';
const OUTPUT_DIR = process.env.VISUAL_QA_OUTPUT || 'visual-qa-results';
const SCOPE = process.env.VISUAL_QA_SCOPE || 'full';

const allRoutes = [
  { name: 'home', path: '/' },
  { name: 'explore', path: '/explore/' },
  { name: 'places', path: '/places/' },
  { name: 'aquatopia', path: '/places/detail.html?id=aquatopia' },
  { name: 'hon-thom', path: '/places/detail.html?id=activity_hon_thom' },
  { name: 'vinwonders', path: '/places/detail.html?id=place_vinwonders' },
  { name: 'dinh-cau', path: '/places/detail.html?id=place_dinh_cau' },
  { name: 'food', path: '/food/' },
  { name: 'food-bun-quay', path: '/food/article.html?id=bun-quay' },
  { name: 'stories', path: '/stories/' },
  { name: 'story-duong-dong', path: '/stories/article.html?id=duong-dong-sau-5-gio' },
  { name: 'about', path: '/about/' },
  { name: 'nearme', path: '/nearme/' },
  { name: 'ferry', path: '/ferry/' },
  { name: 'transit', path: '/transit/' },
  { name: 'bus', path: '/bus/' },
  { name: 'cano', path: '/cano/' },
  { name: 'utilities', path: '/utilities/' },
  { name: 'currency', path: '/currency/' },
  { name: 'airport', path: '/airport/' }
];

const smokeRouteNames = new Set(['home', 'places', 'dinh-cau', 'nearme', 'food-bun-quay', 'bus', 'transit', 'explore', 'utilities', 'currency', 'airport']);
const routes = SCOPE === 'home' ? allRoutes.filter(route => route.name === 'home') : SCOPE === 'smoke' ? allRoutes.filter(route => smokeRouteNames.has(route.name)) : allRoutes;

const viewports = [
  { name: 'desktop-1366x768', width: 1366, height: 768 },
  { name: 'desktop-1440x900', width: 1440, height: 900 },
  { name: 'mobile-390x844', width: 390, height: 844 },
  { name: 'mobile-430x932', width: 430, height: 932 }
];

await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
await fs.mkdir(path.join(OUTPUT_DIR, 'screenshots'), { recursive: true });

const browser = await chromium.launch({ headless: true });
const results = [];

function sameOrigin(url) {
  try {
    return new URL(url).origin === new URL(BASE_URL).origin;
  } catch {
    return false;
  }
}

async function settlePage(page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
  }).catch(() => {});

  await page.evaluate(async () => {
    const step = Math.max(500, Math.floor(window.innerHeight * 0.8));
    const max = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    for (let y = 0; y < max; y += step) {
      window.scrollTo(0, y);
      await new Promise(resolve => setTimeout(resolve, 90));
    }

    await new Promise(resolve => setTimeout(resolve, 180));

    const motionTargets = [...document.querySelectorAll('.energy-target')];
    window.__openpqVisualQaMotionPending = motionTargets.filter(el => !el.classList.contains('in-view')).length;

    // Full-page QA must capture the settled visual state, not a transient
    // IntersectionObserver animation frame. This mutation exists only in the QA browser.
    motionTargets.forEach(el => el.classList.add('in-view'));

    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(500);
}

async function inspectPage(page) {
  return page.evaluate(() => {
    const viewportWidth = window.innerWidth;
    const doc = document.documentElement;
    const body = document.body;
    const documentOverflow = Math.max(doc.scrollWidth, body?.scrollWidth || 0) > viewportWidth + 1;

    const overflowElements = [...document.querySelectorAll('body *')]
      .filter(el => {
        const style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        return rect.left < -1 || rect.right > viewportWidth + 1;
      })
      .slice(0, 12)
      .map(el => {
        const rect = el.getBoundingClientRect();
        return {
          tag: el.tagName.toLowerCase(),
          id: el.id || null,
          className: typeof el.className === 'string' ? el.className.slice(0, 140) : null,
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width)
        };
      });

    const brokenImages = [...document.images]
      .filter(img => img.complete && img.naturalWidth === 0)
      .map(img => ({ src: img.currentSrc || img.src, alt: img.alt || '' }));

    const tinyText = [...document.querySelectorAll('body *')]
      .filter(el => {
        if (['SCRIPT', 'STYLE', 'SVG', 'PATH'].includes(el.tagName)) return false;
        if (el.children.length) return false;
        const text = (el.textContent || '').trim();
        if (!text) return false;
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && parseFloat(style.fontSize) < 11;
      })
      .slice(0, 12)
      .map(el => ({
        text: (el.textContent || '').trim().slice(0, 100),
        fontSize: getComputedStyle(el).fontSize,
        className: typeof el.className === 'string' ? el.className.slice(0, 120) : null
      }));

    return {
      title: document.title,
      motionTargetsPending: Number(window.__openpqVisualQaMotionPending || 0),
      documentOverflow,
      documentScrollWidth: Math.max(doc.scrollWidth, body?.scrollWidth || 0),
      viewportWidth,
      overflowElements,
      brokenImages,
      tinyText
    };
  });
}

async function testHomeFoundation(page) {
  await page.waitForFunction(() => {
    const value = document.querySelector('#tripClockNow')?.textContent?.trim();
    return value && value !== '--:--';
  }, { timeout: 6000 }).catch(() => {});

  const initialNearClean = await page.locator('#nearResults .near-result-card').count().then(n => n === 0).catch(() => false);
  const mobileNear = await page.evaluate(() => matchMedia('(max-width:720px)').matches);
  const collapsedInitially = !mobileNear || (!(await page.locator('.near-quick-results').isVisible()) && !(await page.locator('#nearManualAreas').isVisible()) && !(await page.locator('#nearQuickMore').isVisible()));
  if (mobileNear) await page.locator('#nearAreaToggle').click();
  const area = page.locator('#nearManualAreas [data-area]').first();
  if (await area.count()) {
    await area.click().catch(() => {});
    await page.waitForFunction(() => document.querySelectorAll('#nearResults .near-result-card').length > 0, {timeout:6500}).catch(() => {});
  }
  // The new homepage shows only four essential cards. Check real selection,
  // preservation of category + area when opening /nearme, and direct actions.
  const resultsAfterArea = await page.locator('.near-quick-results').isVisible().catch(()=>false);
  const areaSelectorClosed = !mobileNear || !(await page.locator('#nearManualAreas').isVisible());
  const quickFinder = {
    collapsedInitially,resultsAfterArea,areaSelectorClosed,
    cardsAfterArea:await page.locator('#nearResults .near-result-card').count().catch(()=>0),
    essentials:await page.locator('#nearCategories [data-category]').count().catch(()=>0),
    others:await page.locator('#nearQuickMore [data-category]').count().catch(()=>0),
    emergency:await page.locator('.near-quick-emergency-call[href="tel:115"]').count().then(n=>n===1).catch(()=>false)
  };
  const pharmacy=page.locator('#nearCategories [data-category="PHARMACY"]');
  async function clickPharmacy(){
    // After the area selection, mobile smooth scrolling may still be moving.
    // Centre the real button clear of the fixed header/dock before clicking;
    // do not bypass pointer hit-testing with a synthetic DOM click.
    await pharmacy.evaluate(el=>el.scrollIntoView({behavior:"instant",block:"center",inline:"nearest"}));
    await page.waitForTimeout(180);
    await pharmacy.click({timeout:12000});
  }
  if(await pharmacy.count()){
    await clickPharmacy();
    await page.waitForFunction(() => document.querySelectorAll('#nearResults .near-result-card').length > 0 && new URL(document.querySelector('[data-near-handoff]')?.href||location.href).searchParams.get('category')==='PHARMACY',{timeout:5000}).catch(()=>{});
    quickFinder.pharmacyCards=await page.locator('#nearResults .near-result-card').count().catch(()=>0);
    quickFinder.handoff=await page.locator('[data-near-handoff]').first().getAttribute('href').catch(()=>"");
    quickFinder.directDirections=await page.locator('#nearResults .near-result-actions a[href*="google.com/maps/dir"]').count().then(n=>n>=1).catch(()=>false);
    await clickPharmacy();
  }
  const search=page.locator('#nearQuickSearch');
  if(await search.count()){
    await search.fill('Vietcombank');
    await page.waitForFunction(() => [...document.querySelectorAll('#nearResults .near-result-card strong')].some(el=>el.textContent.includes('Vietcombank')),{timeout:5000}).catch(()=>{});
    quickFinder.searchFound=await page.locator('#nearResults .near-result-card strong').filter({hasText:'Vietcombank'}).count().then(n=>n>0).catch(()=>false);
    await search.fill('');
    await page.waitForFunction(() => document.querySelectorAll('#nearResults .near-result-card').length > 0,{timeout:5000}).catch(()=>{});
  }

  const cancelledToday = await page.evaluate(async () => {
    try {
      const response=await fetch('/data/operational-notices.json',{cache:'no-store'});
      if(!response.ok)return null;
      const notices=await response.json();
      const parts=new Intl.DateTimeFormat('en-GB',{
        timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'
      }).formatToParts(new Date());
      const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
      const today=p.year+'-'+p.month+'-'+p.day;
      return (notices.notices||[]).filter(x=>x.date===today&&x.status==='CANCELLED')
        .map(x=>x.entity_id);
    }catch{return null}
  });
  // Reproduce the reported bug: expanding and collapsing the list must not
  // keep the left clock card stretched to the previous list height.
  const sidebarLayout = await page.evaluate(async () => {
    const grid=document.querySelector(".trip-clock-grid");
    const clock=document.querySelector(".trip-clock-now");
    const featured=document.querySelector("#tripClockList");
    const extra=document.querySelector("#tripClockExtraPanel");
    const extraList=document.querySelector("#tripClockExtraList");
    if(!grid||!clock||!featured||!extra||!extraList)return {ok:false,reason:"Trip clock layout missing"};
    const frame=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const height=node=>Math.round(node.getBoundingClientRect().height);
    const initial=height(clock),featuredHeight=height(featured);
    const initialCards=featured.querySelectorAll(".trip-item").length;
    const button=extra.querySelector("#tripClockMoreBtn");
    let expandedHeight=null,collapsedHeight=null,expandedExtras=0,collapsedExtras=0;
    if(button&&!extra.hidden){
      button.click();
      await frame();
      expandedHeight=height(clock);
      expandedExtras=extraList.querySelectorAll(".trip-item").length;
      button.click();
      await frame();
      collapsedHeight=height(clock);
      collapsedExtras=extraList.querySelectorAll(".trip-item").length;
    }
    const desktop=window.innerWidth>=1100;
    // With eight eligible cards the clock height should follow the height of
    // four rows, and remain unchanged as additional rows expand beneath them.
    const matchedEight= !desktop||initialCards<8||Math.abs(initial-featuredHeight)<=4;
    const stable=expandedHeight===null||Math.abs(expandedHeight-initial)<=4&&Math.abs(collapsedHeight-initial)<=4;
    const toggleRestored=expandedHeight===null||(expandedExtras>0&&collapsedExtras===0&&featured.querySelectorAll(".trip-item").length===initialCards);
    const layout= !desktop||getComputedStyle(clock).gridRowStart==="1"&&getComputedStyle(extra).gridRowStart==="2";
    return {ok:initialCards<=8&&matchedEight&&stable&&toggleRestored&&layout,
      initial,featuredHeight,initialCards,expandedHeight,collapsedHeight,expandedExtras,collapsedExtras,desktop};
  });

  return page.evaluate(({initialNearClean,cancelledToday,sidebarLayout,quickFinder}) => {
    const text = selector => document.querySelector(selector)?.textContent?.trim() || '';
    const count = selector => document.querySelectorAll(selector).length;
    const hanoiHour=Number(new Intl.DateTimeFormat('en-GB',{
      timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',hourCycle:'h23'
    }).format(new Date()));
    const tripCount=count('#tripClockList .trip-item');
    const legitimateLateFallback=!!document.querySelector('#tripClockList .trip-clock-empty')&&
      text('#tripClockList').includes('Giờ này các điểm chính đã qua khung');
    const foodGrid=document.querySelector('#foodNowGrid');
    const newsHeading=document.querySelector('#hot-now .section-heading .eyebrow');
    const foodSection=document.querySelector('#food-now');
    const newsSection=document.querySelector('#hot-now');
    const editorial=document.querySelector('[data-home-chapter="read"]');
    const editorialRect=editorial?.getBoundingClientRect();
    const spacing=foodGrid&&newsHeading&&foodSection&&newsSection ? {
      gap:Math.round(newsHeading.getBoundingClientRect().top-foodGrid.getBoundingClientRect().bottom),
      foodToEditorial:editorialRect?Math.round(editorialRect.top-foodGrid.getBoundingClientRect().bottom):null,
      editorialToNews:editorialRect?Math.round(newsHeading.getBoundingClientRect().top-editorialRect.bottom):null,
      editorialVisible:!!editorialRect&&editorialRect.height>=50&&
        getComputedStyle(editorial).display!=="none",
      foodBottomPadding:getComputedStyle(foodSection).paddingBottom,
      newsTopPadding:getComputedStyle(newsSection).paddingTop,
      containerRowGap:getComputedStyle(foodSection.parentElement).rowGap,
      viewport:window.innerWidth
    } : null;
    const acceptableGap=window.innerWidth<=760 ? 48 : 62;
    // A visible editorial introduction intentionally separates the decision
    // chapter (food) from the reading chapter (news). Measure the spaces on
    // EACH side of that content, not the aggregate food-to-news distance.
    const editorialSpacing=!!spacing&&spacing.editorialVisible&&
      spacing.foodToEditorial>=12&&spacing.foodToEditorial<=95&&
      spacing.editorialToNews>=10&&spacing.editorialToNews<=95;
    const legacySpacing=!!spacing&&!editorial&&
      spacing.gap>=18&&spacing.gap<=acceptableGap;
    const checks = {
      foodNewsSpacing:editorialSpacing||legacySpacing,
      localTime: !!text('#tripClockNow') && text('#tripClockNow') !== '--:--',
      clockPanelCompactAfterToggle: sidebarLayout.ok,
      // Never manufacture three open attractions at night solely to pass CI.
      // At 23:00-07:00 a clear "nothing left today" state is valid.
      tripCards: tripCount>=1 || ((hanoiHour>=23||hanoiHour<7)&&legitimateLateFallback),
      noticesLoaded: Array.isArray(cancelledToday),
      cancelledShowHidden: Array.isArray(cancelledToday) &&
        cancelledToday.every(id=>!document.querySelector('#tripClockList .trip-item[data-entity-id="'+id+'"]')),
      manualAreas: count('#nearManualAreas [data-area]') >= 4,
      nearCategories: count('#nearCategories [data-category]') === 4,
      nearExtraCategories: count('#nearQuickMore [data-category]') === 4,
      nearQuickFinder: quickFinder.collapsedInitially&&quickFinder.resultsAfterArea&&quickFinder.areaSelectorClosed&&quickFinder.essentials===4&&quickFinder.others===4&&quickFinder.cardsAfterArea>=1&&quickFinder.cardsAfterArea<=3&&quickFinder.emergency&&quickFinder.pharmacyCards>=1&&quickFinder.pharmacyCards<=3&&quickFinder.handoff?.includes('area=all')&&quickFinder.handoff?.includes('category=PHARMACY')&&quickFinder.directDirections&&quickFinder.searchFound,
      nearMobileFlow: window.innerWidth>720 || (
        document.querySelector('.near-quick-controls')?.compareDocumentPosition(document.querySelector('.near-quick-results')) & Node.DOCUMENT_POSITION_FOLLOWING &&
        document.querySelector('.near-quick-results')?.compareDocumentPosition(document.querySelector('.near-quick-secondary')) & Node.DOCUMENT_POSITION_FOLLOWING &&
        !text('#nearResults').includes('bên trái')
      ),
      initialNearClean,
      manualResults: count('#nearResults .near-result-card') >= 1,
      noEmbeddedMap: !document.querySelector('#nearMapFrame, .near-map-shell iframe'),
      hotNow: count('#hotNowList .hot-card') >= 1,
      currency: count('#homeCurrencyGrid .home-currency-card') >= 3,
      noSyntheticZero: ![...document.querySelectorAll('#homeCurrencyGrid .home-currency-card strong')].some(el => /^0([,.]0+)?\s*₫$/.test(el.textContent.trim()))
    };
    return { ok: Object.values(checks).every(Boolean), checks, spacing };
  }, {initialNearClean,cancelledToday,sidebarLayout,quickFinder});
}

async function testNearMePage(page) {
  await page.waitForFunction(() => document.querySelectorAll('#nearResults .near-card').length > 0, { timeout: 9000 }).catch(() => {});

  const base = await page.evaluate(() => ({
    search: !!document.querySelector('#nearSearch'),
    map: !!document.querySelector('#nearLeaflet'),
    categoryCount: document.querySelectorAll('#categoryRow [data-category]').length,
    resultCount: document.querySelectorAll('#nearResults .near-card').length,
    mapBadge: document.querySelector('#mapDataBadge')?.textContent?.trim() || '',
    status: document.querySelector('#nearStatus')?.textContent?.trim() || '',
    resultsText: document.querySelector('#nearResults')?.textContent?.trim().slice(0,240) || '',
    state: window.__openpqNearState || null
  }));
  console.log('NEARME_DIAG', JSON.stringify(base));

  const search = page.locator('#nearSearch');
  if (await search.count()) {
    await search.fill('Dinh Cậu');
    await page.waitForTimeout(250);
  }
  const dinhCauFound = await page.locator('#nearResults .near-card').filter({ hasText: /Dinh Cậu/i }).count().then(n => n > 0).catch(() => false);
  const pinVisible = await page.locator('#nearLeaflet .leaflet-marker-icon').count().then(n => n > 0).catch(() => false);

  if (await search.count()) {
    await search.fill('');
    await page.waitForTimeout(150);
  }
  const hotelButton = page.locator('#categoryRow [data-category="HOTEL"]');
  if (await hotelButton.count()) {
    await hotelButton.click();
    await page.waitForTimeout(250);
  }
  const hotelResults = await page.locator('#nearResults .near-card').count().catch(() => 0);

  const checks = {
    searchPresent: base.search,
    mapPresent: base.map,
    categoryLayers: base.categoryCount >= 10,
    initialResults: base.resultCount >= 20,
    dataBadgeResolved: !!base.mapBadge && !/Đang mở/i.test(base.mapBadge),
    destinationSearch: dinhCauFound,
    destinationPin: pinVisible,
    hotelLayer: hotelResults >= 20
  };
  return { ok:Object.values(checks).every(Boolean), checks };
}

async function testUtilitiesPage(page) {
  await page.waitForFunction(() => {
    const stamp=document.querySelector('#currencyUpdated')?.textContent||'';
    return stamp.includes('Cập nhật') || stamp.includes('Bản gần nhất') || stamp.includes('Chưa có');
  }, {timeout:7000}).catch(()=>{});
  return page.evaluate(()=>{
    const preview=document.querySelector('#currencyPreview');
    const codes=[...preview?.querySelectorAll('.u-fx-name span')||[]].map(x=>x.textContent.trim());
    const checks={
      summaryCards:['USD','EUR','KRW'].every(code=>codes.includes(code)),
      rateLabels:!!preview?.textContent.includes('Mua tiền mặt')&&!!preview?.textContent.includes('Bán ra'),
      parentNavigation:!!document.querySelector('.openpq-utility-tabs a[href="#currency"]'),
      detailedConverterLink:!!document.querySelector('.u-fx-cta[href="../currency/"]')
    };
    return {ok:Object.values(checks).every(Boolean),checks};
  });
}

async function testCurrencyPage(page) {
  await page.waitForFunction(() => {
    const badge=document.querySelector('#sourceBadge')?.textContent?.trim();
    return badge && badge !== 'ĐANG TẢI';
  }, { timeout: 7000 }).catch(() => {});
  return page.evaluate(() => {
    const count = selector => document.querySelectorAll(selector).length;
    const checks = {
      sameUtilityNavigation: !!document.querySelector('.openpq-utility-tabs a[aria-current="page"]'),
      sourceResolved: !!document.querySelector('#sourceBadge')?.textContent?.trim() && document.querySelector('#sourceBadge').textContent.trim() !== 'ĐANG TẢI',
      converter: !!document.querySelector('#converterTitle') && !!document.querySelector('[data-mode="foreign-to-vnd"]'),
      rateRows: count('[data-currency], .rate-row, .board-card, .rate-card') >= 3,
      historySurface: !!document.querySelector('canvas, svg, .history-chart, [data-history], #historyChart')
    };
    return { ok:Object.values(checks).every(Boolean), checks };
  });
}

async function testMapCta(page) {
  const buttons = page.getByRole('button', { name: /bản đồ/i });
  const count = await buttons.count();
  if (!count) return { found: false, iframeInserted: false };
  const button = buttons.first();
  await button.click().catch(() => {});
  await page.waitForTimeout(250);
  const iframeInserted = await page.locator('.visual-locator-map iframe').count().then(n => n > 0).catch(() => false);
  return { found: true, iframeInserted };
}
async function testAirportPage(page) {
  await page.waitForFunction(() => {
    const health=document.querySelector('#healthPill')?.textContent?.trim();
    const error=document.querySelector('#errorBox');
    return (health && !/ĐANG TẢI|LOADING/i.test(health)) || (error && !error.classList.contains('hidden'));
  }, { timeout: 9000 }).catch(() => {});

  let drawerInteraction = { found:false, opened:false, closed:false };
  const firstFlight = page.locator('#flightList .flight-row').first();
  if (await firstFlight.count()) {
    drawerInteraction.found=true;
    await firstFlight.click().catch(() => {});
    await page.waitForTimeout(120);
    drawerInteraction.opened=await page.locator('#flightDrawer:not(.hidden)').count().then(n=>n>0).catch(()=>false);
    if (drawerInteraction.opened) {
      await page.locator('#drawerClose').click().catch(() => {});
      await page.waitForTimeout(100);
      drawerInteraction.closed=await page.evaluate(() => {
        const drawer=document.querySelector('#flightDrawer');
        const backdrop=document.querySelector('#drawerBackdrop');
        const hidden=el=>!el || el.classList.contains('hidden') || getComputedStyle(el).display==='none' || getComputedStyle(el).visibility==='hidden';
        return hidden(drawer) && hidden(backdrop);
      }).catch(()=>false);
    }
  }

  const base=await page.evaluate(() => {
    const visible = el => !!el && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden';
    const backdrop=document.querySelector('#drawerBackdrop');
    const drawer=document.querySelector('#flightDrawer');
    const refresh=document.querySelector('#refreshBtn');
    const mobileRefresh=document.querySelector('#mobileRefresh');
    const health=document.querySelector('#healthPill')?.textContent?.trim() || '';
    const error=document.querySelector('#errorBox');
    const resolved = (!!health && !/ĐANG TẢI|LOADING/i.test(health)) || (!!error && !error.classList.contains('hidden'));
    const checks = {
      resolved,
      fidsPresent: !!document.querySelector('#fidsBoard') && !!document.querySelector('#fidsGrid'),
      flightBoardPresent: !!document.querySelector('#flightBoard') && !!document.querySelector('#flightList'),
      noBlockingBackdrop: !visible(backdrop),
      drawerClosedInitially: !visible(drawer),
      refreshUsable: !!refresh && !refresh.disabled,
      mobileRefreshUsable: !!mobileRefresh && !mobileRefresh.disabled
    };
    return { checks, health };
  });
  if(drawerInteraction.found){
    base.checks.drawerOpens=drawerInteraction.opened;
    base.checks.drawerClosesCleanly=drawerInteraction.closed;
  }
  return { ok:Object.values(base.checks).every(Boolean), checks:base.checks, health:base.health, drawerInteraction };
}


try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
      locale: 'vi-VN',
      timezoneId: 'Asia/Ho_Chi_Minh',
      colorScheme: 'light'
    });

    for (const route of routes) {
      const page = await context.newPage();
      const consoleErrors = [];
      const pageErrors = [];
      const failedRequests = [];
      const badResponses = [];
      const externalMapRequests = [];

      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', error => pageErrors.push(error.message));
      page.on('request', request => {
        if (/google\.com\/maps|maps\.googleapis\.com|openstreetmap|mapbox/i.test(request.url())) externalMapRequests.push(request.url());
      });
      page.on('requestfailed', request => {
        if (sameOrigin(request.url())) failedRequests.push({ url: request.url(), error: request.failure()?.errorText || 'request failed' });
      });
      page.on('response', response => {
        if (sameOrigin(response.url()) && response.status() >= 400) {
          badResponses.push({ url: response.url(), status: response.status() });
        }
      });

      const url = new URL(route.path, BASE_URL).toString();
      let navigationError = null;
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await settlePage(page);
      } catch (error) {
        navigationError = error.message;
      }

      const inspection = navigationError ? null : await inspectPage(page);
      const screenshotName = `${route.name}__${viewport.width}x${viewport.height}.png`;
      const screenshotPath = path.join(OUTPUT_DIR, 'screenshots', screenshotName);
      await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});

      let mapCta = null;
      let homeFunctional = null;
      let currencyFunctional = null;
      let utilitiesFunctional = null;
      let airportFunctional = null;
      let nearmeFunctional = null;
      if (!navigationError && route.name === 'home') {
        homeFunctional = await testHomeFoundation(page);
        console.log('HOME_SECTION_SPACING', JSON.stringify(homeFunctional.spacing));
      }
      if (!navigationError && route.name === 'nearme') {
        nearmeFunctional = await testNearMePage(page);
      }
      if (!navigationError && route.name === 'utilities') {
        utilitiesFunctional = await testUtilitiesPage(page);
      }
      if (!navigationError && route.name === 'currency') {
        currencyFunctional = await testCurrencyPage(page);
      }
      if (!navigationError && route.name === 'airport') {
        airportFunctional = await testAirportPage(page);
      }
      if (!navigationError && route.path.includes('/places/detail.html')) {
        mapCta = await testMapCta(page);
      }

      const sameOriginBrokenImages = (inspection?.brokenImages || []).filter(img => sameOrigin(img.src));
      const expectedStaticApiResponses = ['currency','utilities'].includes(route.name)
        ? badResponses.filter(item => {
            try { return new URL(item.url).pathname.startsWith('/api/exchange-rates'); }
            catch { return false; }
          })
        : [];
      const unexpectedBadResponses = badResponses.filter(item => !expectedStaticApiResponses.includes(item));

      const strictFailures = [
        navigationError ? `navigation: ${navigationError}` : null,
        inspection?.documentOverflow ? `horizontal overflow: ${inspection.documentScrollWidth}px > ${inspection.viewportWidth}px` : null,
        sameOriginBrokenImages.length ? `${sameOriginBrokenImages.length} broken same-origin image(s)` : null,
        pageErrors.length ? `${pageErrors.length} page error(s)` : null,
        failedRequests.length ? `${failedRequests.length} failed same-origin request(s)` : null,
        unexpectedBadResponses.length ? `${unexpectedBadResponses.length} bad same-origin response(s)` : null,
        homeFunctional && !homeFunctional.ok ? `homepage functional checks failed: ${Object.entries(homeFunctional.checks).filter(([,ok])=>!ok).map(([key])=>key).join(",")}` : null,
        utilitiesFunctional && !utilitiesFunctional.ok ? `utilities functional checks failed: ${Object.entries(utilitiesFunctional.checks).filter(([,ok])=>!ok).map(([key])=>key).join(",")}` : null,
        currencyFunctional && !currencyFunctional.ok ? `currency functional checks failed: ${Object.entries(currencyFunctional.checks).filter(([,ok])=>!ok).map(([key])=>key).join(",")}` : null,
        airportFunctional && !airportFunctional.ok ? `airport functional checks failed: ${Object.entries(airportFunctional.checks).filter(([,ok])=>!ok).map(([key])=>key).join(",")}` : null,
        nearmeFunctional && !nearmeFunctional.ok ? `nearme functional checks failed: ${Object.entries(nearmeFunctional.checks).filter(([,ok])=>!ok).map(([key])=>key).join(",")}` : null,
        route.name === 'home' && externalMapRequests.length ? `homepage made ${externalMapRequests.length} external map request(s)` : null
      ].filter(Boolean);

      results.push({
        route: route.name,
        path: route.path,
        viewport,
        url,
        screenshot: `screenshots/${screenshotName}`,
        status: strictFailures.length ? 'fail' : 'pass',
        strictFailures,
        inspection,
        mapCta,
        homeFunctional,
        currencyFunctional,
        utilitiesFunctional,
        airportFunctional,
        nearmeFunctional,
        consoleErrors,
        pageErrors,
        failedRequests,
        badResponses,
        expectedStaticApiResponses,
        externalMapRequests
      });

      console.log(`${strictFailures.length ? 'FAIL' : 'PASS'} ${route.name} ${viewport.width}x${viewport.height}${strictFailures.length ? ` - ${strictFailures.join('; ')}` : ''}`);
      await page.close();
    }

    await context.close();
  }
} finally {
  await browser.close();
}

const failures = results.filter(result => result.status === 'fail');
const warnings = results.reduce((count, result) => {
  const remoteBroken = (result.inspection?.brokenImages || []).filter(img => !sameOrigin(img.src)).length;
  const tiny = result.inspection?.tinyText?.length || 0;
  return count + remoteBroken + result.consoleErrors.length + tiny;
}, 0);

const summary = {
  generatedAt: new Date().toISOString(),
  scope: SCOPE,
  baseUrl: BASE_URL,
  routeCount: routes.length,
  viewportCount: viewports.length,
  screenshotCount: results.length,
  passCount: results.length - failures.length,
  failCount: failures.length,
  warningSignals: warnings,
  results
};

await fs.writeFile(path.join(OUTPUT_DIR, 'report.json'), JSON.stringify(summary, null, 2));

const md = [
  '# Open Phu Quoc Visual QA',
  '',
  `- Generated: ${summary.generatedAt}`,
  `- Scope: ${summary.scope}`,
  `- Routes: ${summary.routeCount}`,
  `- Viewports: ${summary.viewportCount}`,
  `- Screenshots: ${summary.screenshotCount}`,
  `- Passed: ${summary.passCount}`,
  `- Failed: ${summary.failCount}`,
  '',
  '| Route | Viewport | Status | Notes |',
  '| --- | --- | --- | --- |',
  ...results.map(result => {
    const remoteBroken = (result.inspection?.brokenImages || []).filter(img => !sameOrigin(img.src)).length;
    const notes = [
      ...result.strictFailures,
      remoteBroken ? `${remoteBroken} remote image warning(s)` : null,
      result.consoleErrors.length ? `${result.consoleErrors.length} console error(s)` : null,
      result.inspection?.motionTargetsPending ? `${result.inspection.motionTargetsPending} motion target(s) needed QA settle` : null,
      result.inspection?.tinyText?.length ? `${result.inspection.tinyText.length} text item(s) under 11px` : null,
      result.mapCta?.found ? `map CTA: ${result.mapCta.iframeInserted ? 'ok' : 'iframe not inserted'}` : null,
      result.homeFunctional?.ok ? `home functional: ok` : null,
      result.currencyFunctional?.ok ? `currency functional: ok` : null,
      result.utilitiesFunctional?.ok ? `utilities functional: ok` : null,
      result.expectedStaticApiResponses?.length ? `${result.expectedStaticApiResponses.length} expected static API fallback response(s)` : null,
      result.airportFunctional?.ok ? `airport functional: ok` : null,
      result.nearmeFunctional?.ok ? `nearme functional: ok` : null
    ].filter(Boolean).join('; ') || 'OK';
    return `| ${result.route} | ${result.viewport.width}x${result.viewport.height} | ${result.status.toUpperCase()} | ${notes.replaceAll('|', '\|')} |`;
  })
];

await fs.writeFile(path.join(OUTPUT_DIR, 'report.md'), `${md.join('\n')}\n`);

if (failures.length) process.exitCode = 1;
