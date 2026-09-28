const te = new TextEncoder();
const td = new TextDecoder();

export const CMS_REPO = "kenzuko/jotrip-home";
export const CMS_REPO_API = "https://api.github.com/repos/" + CMS_REPO;
export const CMS_SESSION_COOKIE = "openpq_cms";

function cookieValue(request, name) {
  for (const part of (request.headers.get("cookie") || "").split(";")) {
    const i = part.indexOf("=");
    if (i <= 0 || part.slice(0, i).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      return "";
    }
  }
  return "";
}

function base64UrlBytes(raw) {
  let s = String(raw || "").replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}

async function sessionKey(secret) {
  const digest = await crypto.subtle.digest("SHA-256", te.encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["decrypt"]);
}

export async function readCmsSession(request, secret, { requireAccessToken = false } = {}) {
  const token = cookieValue(request, CMS_SESSION_COOKIE);
  if (!token || !secret) return null;
  try {
    const [iv, payload] = token.split(".");
    if (!iv || !payload) return null;
    const key = await sessionKey(secret);
    const clear = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64UrlBytes(iv) },
      key,
      base64UrlBytes(payload)
    );
    const session = JSON.parse(td.decode(clear));
    if (!(session?.exp > Date.now())) return null;
    if (requireAccessToken && !session.accessToken) return null;
    return session;
  } catch {
    return null;
  }
}

export async function readCurrentCmsRole(login, {
  cacheBustKey = "t",
  failureMessage = "Không kiểm tra được quyền CMS",
  failureCode = null,
  includeUserAgent = true,
} = {}) {
  const headers = includeUserAgent ? { "User-Agent": "Open-Phu-Quoc-CMS" } : {};
  const response = await fetch(
    "https://raw.githubusercontent.com/" + CMS_REPO + "/main/cms/users.json?" +
      encodeURIComponent(cacheBustKey) + "=" + Date.now(),
    { headers, cache: "no-store" }
  );
  if (!response.ok) {
    const error = new Error(
      failureMessage + (failureMessage.includes("HTTP") ? "" : "")
    );
    if (failureCode != null) error.code = failureCode;
    error.httpStatus = response.status;
    throw error;
  }
  const doc = await response.json();
  return (doc.users || []).find(
    x => String(x.login).toLowerCase() === String(login).toLowerCase() && x.enabled !== false
  )?.role || null;
}

export function sameOrigin(request, { allowMissing = true } = {}) {
  const origin = request.headers.get("Origin");
  const expected = new URL(request.url).origin;
  return allowMissing ? (!origin || origin === expected) : origin === expected;
}

export function githubHeaders(token, { contentType = true } = {}) {
  return {
    Accept: "application/vnd.github+json",
    ...(contentType ? { "Content-Type": "application/json" } : {}),
    "X-GitHub-Api-Version": "2022-11-28",
    Authorization: "Bearer " + token,
    "User-Agent": "Open-Phu-Quoc-CMS",
  };
}

export async function githubJson(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...githubHeaders(token),
      ...(options.headers || {}),
    },
    cache: "no-store",
  });
  let value = null;
  try {
    value = await response.json();
  } catch {
    value = {};
  }
  return {
    response,
    value,
    link: response.headers.get("link") || "",
  };
}

export function encodeRepoPath(path) {
  return String(path || "").split("/").map(encodeURIComponent).join("/");
}
