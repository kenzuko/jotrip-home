// Temporary, isolated Places UI overlay. NEVER handles Weather/API or replaces the canonical Worker.
// The only owned assets are /places/, /places/app.js and /places/catalog-cards.css.
// Everything else is handed back to the existing openphuquoc.com Custom Domain Worker.
const ORIGIN = "https://openphuquoc.com";
const owned = new Set(["/places/", "/places/index.html", "/places/app.js", "/places/catalog-cards.css"]);
let parentSupportsCards = false;
let nextParentCheck = 0;

async function parent(request) {
  const original = new URL(request.url);
  const dest = new URL(original.pathname + original.search, ORIGIN);
  return fetch(new Request(dest.toString(), request));
}

function checkForPermanentRelease(ctx) {
  if (parentSupportsCards || Date.now() < nextParentCheck) return;
  nextParentCheck = Date.now() + 5 * 60 * 1000;
  // A newer, successful canonical release can transparently take back the route.
  // This is a background check; first-time visitor rendering never waits for it.
  ctx.waitUntil(fetch(ORIGIN + "/places/catalog-cards.css?ui-overlay-check=1", {
    headers: { accept: "text/css" },
    signal: AbortSignal.timeout(7000)
  }).then(async res => {
    if (!res.ok) return;
    const css = await res.text();
    if (css.includes(".place-quick-facts") && css.includes(".place-more"))
      parentSupportsCards = true;
  }).catch(() => {}));
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (!["GET", "HEAD"].includes(request.method) || 
        (!owned.has(path) && path !== "/places")) return parent(request);
    if (parentSupportsCards) return parent(request);
    checkForPermanentRelease(ctx);
    if (path === "/places") {
      const canonical = new URL(url);
      canonical.pathname = "/places/";
      return Response.redirect(canonical, 308);
    }
    const assetPath = path === "/places/index.html" ? "/places/" : path;
    const local = new URL(request.url);
    local.pathname = assetPath;
    // The assets binding contains ONLY three pinned, approved UI files.
    const response = await env.UI_ASSETS.fetch(new Request(local.toString(), request));
    if (!response.ok) return new Response("Places hotfix asset unavailable", {status:503});
    const headers = new Headers(response.headers);
    headers.set("x-openpq-places-ui", "isolated-hotfix-r1");
    if (path === "/places/" || path === "/places/index.html")
      headers.set("cache-control", "public, max-age=60, must-revalidate");
    return new Response(request.method === "HEAD" ? null : response.body,
      {status: response.status, headers});
  }
};
