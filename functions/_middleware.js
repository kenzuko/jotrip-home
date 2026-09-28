const CMS_HOST = "cms.openphuquoc.com";
const PUBLIC_ORIGIN = "https://openphuquoc.com";
const SESSION_COOKIE = "openpq_cms";

const KEEP_PREFIXES = [
  "/admin",
  "/api/",
  "/assets/",
  "/data/",
  "/core/"
];

const STATIC_FILE = /\.(?:css|js|mjs|json|png|jpe?g|webp|gif|svg|ico|woff2?|ttf|map)$/i;

function hasCmsSession(request) {
  const raw = request.headers.get("cookie") || "";
  return raw.split(";").some(part => part.trim().startsWith(SESSION_COOKIE + "="));
}

function shouldPassThrough(pathname) {
  if (KEEP_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(prefix.endsWith("/") ? prefix : prefix + "/"))) return true;
  if (pathname.startsWith("/weather/data/")) return true;
  if (STATIC_FILE.test(pathname)) return true;
  return false;
}

function publicUrl(url) {
  const target = new URL(PUBLIC_ORIGIN);
  target.pathname = url.pathname;
  target.search = url.search;
  return target.toString();
}

function noindex(response) {
  const headers = new Headers(response.headers);
  headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export async function onRequest(context) {
  const {request} = context;
  const url = new URL(request.url);

  if (url.hostname !== CMS_HOST) return context.next();
  if (!["GET", "HEAD"].includes(request.method)) return context.next();
  if (shouldPassThrough(url.pathname)) return context.next();

  if (!hasCmsSession(request)) {
    return Response.redirect(publicUrl(url), 301);
  }

  return noindex(await context.next());
}
