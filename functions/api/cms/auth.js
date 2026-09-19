const REPO = "kenzuko/jotrip-home";
const BRANCH = "main";
const CALLBACK = "https://cms.openphuquoc.com/api/cms/auth?action=callback";
const SESSION_COOKIE = "openpq_cms";
const STATE_COOKIE = "openpq_oauth_state";

const te = new TextEncoder();
const td = new TextDecoder();

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    },
  });

const parseCookies = (req) => {
  const out = {};
  for (const part of (req.headers.get("cookie") || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
};

const cookie = (name, value, maxAge) =>
  `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

const clearCookie = (name) => cookie(name, "", 0);

const toStdB64 = (u8) => {
  let s = "";
  for (const b of u8) s += String.fromCharCode(b);
  return btoa(s);
};

const toUrlB64 = (u8) =>
  toStdB64(u8).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

async function aesKey(secret) {
  const digest = await crypto.subtle.digest("SHA-256", te.encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt"]);
}

async function seal(obj, secret) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await aesKey(secret);
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      te.encode(JSON.stringify(obj))
    )
  );
  return toUrlB64(iv) + "." + toUrlB64(encrypted);
}

async function github(path, token) {
  const r = await fetch("https://api.github.com" + path, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      Authorization: `Bearer ${token}`,
      "User-Agent": "Open-Phu-Quoc-CMS",
    },
  });
  const body = await r.json();
  if (!r.ok) throw new Error(body?.message || `GitHub HTTP ${r.status}`);
  return body;
}

async function roleFor(token, login) {
  const f = await github(`/repos/${REPO}/contents/cms/users.json?ref=${BRANCH}`, token);
  const raw = td.decode(
    Uint8Array.from(atob(String(f.content || "").replace(/\s/g, "")), (c) => c.charCodeAt(0))
  );
  const doc = JSON.parse(raw);
  const user = (doc.users || []).find(
    (x) =>
      String(x.login).toLowerCase() === String(login).toLowerCase() &&
      x.enabled !== false
  );
  return user?.role || null;
}

function redirect(location, cookies) {
  const headers = new Headers({ Location: location, "Cache-Control": "no-store" });
  for (const c of cookies) headers.append("Set-Cookie", c);
  return new Response(null, { status: 302, headers });
}

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const action = url.searchParams.get("action") || "login";

  const clientId = String(env.GITHUB_OAUTH_CLIENT_ID || "").trim();
  const clientSecret = String(env.GITHUB_OAUTH_CLIENT_SECRET || "").trim();
  const sessionSecret = String(env.CMS_SESSION_SECRET || "").trim();

  if (!clientId || !clientSecret || !sessionSecret) {
    return json({ error: "CMS OAuth chưa được cấu hình đầy đủ" }, 503);
  }

  if (action === "logout") {
    return json({ ok: true }, 200, { "Set-Cookie": clearCookie(SESSION_COOKIE) });
  }

  if (action === "login") {
    const state = toUrlB64(crypto.getRandomValues(new Uint8Array(24)));
    const githubAuth = new URL("https://github.com/login/oauth/authorize");
    githubAuth.searchParams.set("client_id", clientId);
    githubAuth.searchParams.set("redirect_uri", CALLBACK);
    githubAuth.searchParams.set("scope", "public_repo read:user");
    githubAuth.searchParams.set("state", state);
    githubAuth.searchParams.set("allow_signup", "false");
    return redirect(githubAuth.toString(), [cookie(STATE_COOKIE, state, 600)]);
  }

  if (action !== "callback") {
    return json({ error: "Action không hợp lệ" }, 400);
  }

  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const storedState = parseCookies(request)[STATE_COOKIE] || "";

  if (!code || !state || !storedState || state !== storedState) {
    return json(
      { error: "OAuth state không hợp lệ. Hãy đăng nhập lại từ đầu." },
      400,
      { "Set-Cookie": clearCookie(STATE_COOKIE) }
    );
  }

  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Open-Phu-Quoc-CMS",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  const tokenBody = await tokenResponse.json();

  if (!tokenResponse.ok || !tokenBody.access_token) {
    return json(
      {
        error: "GitHub OAuth token exchange failed",
        github_error: tokenBody?.error || "unknown_error",
        detail: tokenBody?.error_description || "GitHub không trả về access token",
      },
      401,
      { "Set-Cookie": clearCookie(STATE_COOKIE) }
    );
  }

  const ghUser = await github("/user", tokenBody.access_token);
  const role = await roleFor(tokenBody.access_token, ghUser.login);

  if (!role) {
    return json({ error: "Tài khoản GitHub này chưa được cấp quyền CMS" }, 403);
  }

  const sessionToken = await seal(
    {
      login: ghUser.login,
      name: ghUser.name || ghUser.login,
      avatar: ghUser.avatar_url || null,
      role,
      accessToken: tokenBody.access_token,
      exp: Date.now() + 12 * 60 * 60 * 1000,
    },
    sessionSecret
  );

  return redirect("/admin/", [
    cookie(SESSION_COOKIE, sessionToken, 12 * 60 * 60),
    clearCookie(STATE_COOKIE),
  ]);
}
