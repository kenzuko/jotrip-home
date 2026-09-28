const sessionEncoder = new TextEncoder();
const sessionDecoder = new TextDecoder();

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
  const digest = await crypto.subtle.digest("SHA-256", sessionEncoder.encode(secret));
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
    const session = JSON.parse(sessionDecoder.decode(clear));
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
  includeHttpStatus = false,
} = {}) {
  const headers = includeUserAgent ? { "User-Agent": "Open-Phu-Quoc-CMS" } : {};
  const response = await fetch(
    "https://raw.githubusercontent.com/" + CMS_REPO + "/main/cms/users.json?" +
      encodeURIComponent(cacheBustKey) + "=" + Date.now(),
    { headers, cache: "no-store" }
  );
  if (!response.ok) {
    const error = new Error(includeHttpStatus ? failureMessage + ": HTTP " + response.status : failureMessage);
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


export async function readMainRef(token) {
  const result = await githubJson(CMS_REPO_API + "/git/ref/heads/main", token);
  return {
    ok: result.response.ok,
    status: result.response.status,
    sha: result.value?.object?.sha || null,
    value: result.value,
  };
}

export async function readRepoFile(path, ref, token) {
  const result = await githubJson(
    CMS_REPO_API + "/contents/" + encodeRepoPath(path) + "?ref=" + encodeURIComponent(ref),
    token
  );
  return {
    ok: result.response.ok,
    status: result.response.status,
    sha: result.value?.sha || null,
    value: result.value,
  };
}

export async function scanOpenPullConflicts(paths, token, {
  cmsDraftOnly = true,
  inspectLimit = Infinity,
  requireComplete = false,
  concurrency = 3,
} = {}) {
  const wanted = new Set(Array.from(paths || []).map(String));
  const pullsResult = await githubJson(
    CMS_REPO_API + "/pulls?state=open&per_page=100&sort=updated&direction=desc",
    token
  );
  if (!pullsResult.response.ok) {
    return {
      ok: false,
      status: pullsResult.response.status,
      stage: "pulls",
      detail: pullsResult.value?.message || "Không đọc được hàng đợi PR",
      complete: false,
      conflicts: [],
    };
  }
  if (!Array.isArray(pullsResult.value)) {
    return {
      ok: false,
      status: 502,
      stage: "pulls",
      detail: "Không đọc được hàng đợi PR",
      complete: false,
      conflicts: [],
    };
  }

  const pending = cmsDraftOnly
    ? pullsResult.value.filter(pr => String(pr.head?.ref || "").startsWith("cms/draft/"))
    : pullsResult.value;
  const max = Number.isFinite(inspectLimit) ? Math.max(0, inspectLimit) : pending.length;
  const inspect = pending.slice(0, max);
  const conflicts = [];
  let complete =
    !/rel="next"/.test(pullsResult.link || "") &&
    inspect.length === pending.length;

  const width = Math.max(1, Math.min(6, Number(concurrency) || 3));
  for (let i = 0; i < inspect.length; i += width) {
    const batch = await Promise.all(inspect.slice(i, i + width).map(async pr => {
      const listing = await githubJson(
        CMS_REPO_API + "/pulls/" + pr.number + "/files?per_page=100",
        token
      );
      return { pr, listing };
    }));
    for (const item of batch) {
      if (!item.listing.response.ok) {
        return {
          ok: false,
          status: item.listing.response.status,
          stage: "files",
          pr: item.pr,
          detail: item.listing.value?.message || "Không đọc được danh sách tệp thay đổi",
          complete: false,
          conflicts,
        };
      }
      if (!Array.isArray(item.listing.value)) {
        return {
          ok: false,
          status: 502,
          stage: "files",
          pr: item.pr,
          detail: "Không đọc được danh sách tệp thay đổi",
          complete: false,
          conflicts,
        };
      }
      if (/rel="next"/.test(item.listing.link || "")) complete = false;
      if (item.listing.value.some(file => wanted.has(file.filename))) {
        conflicts.push({
          number: item.pr.number,
          title: item.pr.title || "",
          url: item.pr.html_url || ("https://github.com/" + CMS_REPO + "/pull/" + item.pr.number),
          author: item.pr.user?.login || "",
          updated_at: item.pr.updated_at || null,
        });
      }
    }
  }

  if (requireComplete && !complete) {
    return {
      ok: false,
      status: 409,
      stage: "incomplete",
      detail: "Chưa thể kiểm tra toàn bộ đề xuất đang mở",
      complete: false,
      conflicts,
    };
  }
  return {
    ok: true,
    status: 200,
    complete,
    conflicts,
    pending_count: pending.length,
    inspected_count: inspect.length,
  };
}
