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


function normalizeMutationText(value,max=240){
  return String(value??"").trim().slice(0,max);
}

function normalizeMutationSha(value){
  const sha=String(value||"").trim().toLowerCase();
  return /^[a-f0-9]{40}$/.test(sha)?sha:null;
}

function normalizeMutationShaMap(value){
  const out={};
  for(const [path,sha] of Object.entries(value&&typeof value==="object"?value:{})){
    const cleanPath=normalizeMutationText(path,500);
    const cleanSha=normalizeMutationSha(sha);
    if(cleanPath&&cleanSha)out[cleanPath]=cleanSha;
  }
  return out;
}

export function createCmsMutationAudit({
  operation,actor,role,baseMainSha,paths,beforeFileShas,afterFileShas,
  changedFields,recordId,branch,sourcePrNumber,mutationCommitSha,resultMainSha
}={}){
  const before=normalizeMutationShaMap(beforeFileShas);
  const after=normalizeMutationShaMap(afterFileShas);
  const normalizedPaths=Array.from(new Set([
    ...(Array.isArray(paths)?paths:[]),
    ...Object.keys(before),
    ...Object.keys(after)
  ].map(x=>normalizeMutationText(x,500)).filter(Boolean)));
  const fields=Array.from(new Set((Array.isArray(changedFields)?changedFields:[])
    .map(x=>normalizeMutationText(x,500)).filter(Boolean)));
  const sourcePr=Number(sourcePrNumber);
  return{
    schema:"openpq-cms-mutation-v1",
    operation:normalizeMutationText(operation,80),
    actor:normalizeMutationText(actor,120),
    role:normalizeMutationText(role,40)||null,
    base_main_sha:normalizeMutationSha(baseMainSha),
    paths:normalizedPaths,
    before_file_shas:before,
    after_file_shas:after,
    changed_fields:fields,
    record_id:normalizeMutationText(recordId,240)||null,
    branch:normalizeMutationText(branch,240)||null,
    source_pr_number:Number.isSafeInteger(sourcePr)&&sourcePr>0?sourcePr:null,
    mutation_commit_sha:normalizeMutationSha(mutationCommitSha),
    result_main_sha:normalizeMutationSha(resultMainSha)
  };
}

export function formatCmsMutationAudit(value){
  const audit=createCmsMutationAudit(value);
  return "## CMS mutation metadata\n\n```json\n"+JSON.stringify(audit,null,2)+"\n```";
}

export function cmsMutationCommitTrailers(value){
  const audit=createCmsMutationAudit(value);
  const shaPairs=map=>Object.entries(map).map(([path,sha])=>path+"="+sha).join(";");
  return[
    "OpenPQ-CMS-Mutation: v1",
    "CMS-Operation: "+audit.operation,
    "CMS-Actor: "+audit.actor,
    ...(audit.role?["CMS-Role: "+audit.role]:[]),
    ...(audit.base_main_sha?["CMS-Base-Main-SHA: "+audit.base_main_sha]:[]),
    ...(audit.paths.length?["CMS-Paths: "+audit.paths.join(",")]:[]),
    ...(Object.keys(audit.before_file_shas).length?["CMS-Before-File-SHAs: "+shaPairs(audit.before_file_shas)]:[]),
    ...(Object.keys(audit.after_file_shas).length?["CMS-After-File-SHAs: "+shaPairs(audit.after_file_shas)]:[]),
    ...(audit.changed_fields.length?["CMS-Changed-Fields: "+audit.changed_fields.join(",")]:[]),
    ...(audit.record_id?["CMS-Record-ID: "+audit.record_id]:[]),
    ...(audit.branch?["CMS-Branch: "+audit.branch]:[]),
    ...(audit.source_pr_number?["CMS-Source-PR: "+audit.source_pr_number]:[])
  ].join("\n");
}
