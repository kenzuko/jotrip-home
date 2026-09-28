const CMS_HOST = "cms.openphuquoc.com";
const PUBLIC_ORIGIN = "https://openphuquoc.com";
const SESSION_COOKIE = "openpq_cms";

const TECHNICAL_PREFIXES = [
  "/admin",
  "/api/",
  "/weather/data/",
  "/data/meta/",
  "/assets/",
  "/favicon",
  "/apple-touch-icon",
  "/manifest"
];

function hasCmsSession(request) {
  const cookie = request.headers.get("cookie") || "";
  return cookie.split(";").some((part) => part.trim().startsWith(SESSION_COOKIE + "="));
}

function isTechnicalPath(pathname) {
  return TECHNICAL_PREFIXES.some((prefix) =>
    prefix.endsWith("/") ? pathname.startsWith(prefix) : pathname === prefix || pathname.startsWith(prefix + "/")
  );
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
  const request = context.request;
  const url = new URL(request.url);

  if (url.hostname.toLowerCase() !== CMS_HOST) return context.next();

  if (isTechnicalPath(url.pathname)) {
    return noindex(await context.next());
  }

  if (hasCmsSession(request)) {
    return noindex(await context.next());
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Not found", {
      status: 404,
      headers: {
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow, noarchive"
      }
    });
  }

  const target = new URL(url.pathname + url.search, PUBLIC_ORIGIN);
  return new Response(null, {
    status: 301,
    headers: {
      Location: target.toString(),
      "Cache-Control": "public, max-age=300",
      "X-Robots-Tag": "noindex, nofollow, noarchive"
    }
  });
}

export const __test = { hasCmsSession, isTechnicalPath, CMS_HOST, PUBLIC_ORIGIN };
