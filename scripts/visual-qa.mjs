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
  { name: 'ferry', path: '/ferry/' },
  { name: 'transit', path: '/transit/' },
  { name: 'bus', path: '/bus/' },
  { name: 'cano', path: '/cano/' },
  { name: 'currency', path: '/currency/' },
  { name: 'airport', path: '/airport/' }
];

const smokeRouteNames = new Set(['home', 'places', 'dinh-cau', 'food-bun-quay', 'bus', 'transit', 'currency', 'airport']);
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
  const area = page.locator('#nearManualAreas [data-area]').first();
  if (await area.count()) {
    await area.click().catch(() => {});
    await page.waitForTimeout(450);
  }

  return page.evaluate((initialNearClean) => {
    const text = selector => document.querySelector(selector)?.textContent?.trim() || '';
    const count = selector => document.querySelectorAll(selector).length;
    const checks = {
      localTime: !!text('#tripClockNow') && text('#tripClockNow') !== '--:--',
      tripCards: count('#tripClockList .trip-item') >= 3,
      manualAreas: count('#nearManualAreas [data-area]') >= 4,
      nearCategories: count('#nearCategories [data-category]') >= 5,
      initialNearClean,
      manualResults: count('#nearResults .near-result-card') >= 1,
      noEmbeddedMap: !document.querySelector('#nearMapFrame, .near-map-shell iframe'),
      hotNow: count('#hotNowList .hot-card') >= 1,
      currency: count('#homeCurrencyGrid .home-currency-card') >= 3,
      noSyntheticZero: ![...document.querySelectorAll('#homeCurrencyGrid .home-currency-card strong')].some(el => /^0([,.]0+)?\s*₫$/.test(el.textContent.trim()))
    };
    return { ok: Object.values(checks).every(Boolean), checks };
  }, initialNearClean);
}

async function testCurrencyPage(page) {
  await page.waitForFunction(() => {
    const badge=document.querySelector('#sourceBadge')?.textContent?.trim();
    return badge && badge !== 'ĐANG TẢI';
  }, { timeout: 7000 }).catch(() => {});
  return page.evaluate(() => {
    const count = selector => document.querySelectorAll(selector).length;
    const checks = {
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

  return page.evaluate(() => {
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
    return { ok:Object.values(checks).every(Boolean), checks, health };
  });
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
      let airportFunctional = null;
      if (!navigationError && route.name === 'home') {
        homeFunctional = await testHomeFoundation(page);
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
      const strictFailures = [
        navigationError ? `navigation: ${navigationError}` : null,
        inspection?.documentOverflow ? `horizontal overflow: ${inspection.documentScrollWidth}px > ${inspection.viewportWidth}px` : null,
        sameOriginBrokenImages.length ? `${sameOriginBrokenImages.length} broken same-origin image(s)` : null,
        pageErrors.length ? `${pageErrors.length} page error(s)` : null,
        failedRequests.length ? `${failedRequests.length} failed same-origin request(s)` : null,
        badResponses.length ? `${badResponses.length} bad same-origin response(s)` : null,
        homeFunctional && !homeFunctional.ok ? `homepage functional checks failed: ${Object.entries(homeFunctional.checks).filter(([,ok])=>!ok).map(([key])=>key).join(",")}` : null,
        currencyFunctional && !currencyFunctional.ok ? `currency functional checks failed: ${Object.entries(currencyFunctional.checks).filter(([,ok])=>!ok).map(([key])=>key).join(",")}` : null,
        airportFunctional && !airportFunctional.ok ? `airport functional checks failed: ${Object.entries(airportFunctional.checks).filter(([,ok])=>!ok).map(([key])=>key).join(",")}` : null,
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
        airportFunctional,
        consoleErrors,
        pageErrors,
        failedRequests,
        badResponses,
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
      result.airportFunctional?.ok ? `airport functional: ok` : null
    ].filter(Boolean).join('; ') || 'OK';
    return `| ${result.route} | ${result.viewport.width}x${result.viewport.height} | ${result.status.toUpperCase()} | ${notes.replaceAll('|', '\|')} |`;
  })
];

await fs.writeFile(path.join(OUTPUT_DIR, 'report.md'), `${md.join('\n')}\n`);

if (failures.length) process.exitCode = 1;
