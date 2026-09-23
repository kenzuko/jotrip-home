import {onRequestPost as cmsWeatherFeedbackPost} from "./functions/api/weather/live/feedback.js";
import {onRequestGet as cmsWeatherFeedbackRecent} from "./functions/api/weather/live/feedback/recent.js";
const SITE_ORIGIN = "https://openphuquoc.com";
const DEFAULT_IMAGE = SITE_ORIGIN + "/assets/logo-master.png";

function cleanText(value, fallback = "") {
  return String(value ?? fallback).replace(/\s+/g, " ").trim();
}
function truncate(value, max = 190) {
  const s = cleanText(value);
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + "…";
}
async function readAssetJson(env, requestUrl, pathname) {
  const url = new URL(pathname, requestUrl);
  const response = await env.ASSETS.fetch(new Request(url, { method: "GET" }));
  if (!response.ok) throw new Error(pathname + " " + response.status);
  return response.json();
}
function pickVisualImage(visual) {
  const images = Array.isArray(visual?.images) ? visual.images : [];
  return (
    images.find(x => x?.url && x.hero_priority === "primary" && x.hero_eligible !== false) ||
    images.find(x => x?.url && x.visual_quality === "hero" && x.hero_eligible !== false) ||
    images.find(x => x?.url && x.hero_eligible !== false) ||
    null
  );
}
async function storyMeta(url, env) {
  const id = url.searchParams.get("id");
  if (!id) return null;
  const data = await readAssetJson(env, url, "/data/content.json");
  const story = (data.stories || []).find(x => x.id === id);
  if (!story) return null;
  return {
    type: "article",
    title: cleanText(story.title) + " - Open Phu Quoc",
    description: truncate(story.dek || story.intro || "Câu chuyện về Phú Quốc."),
    canonical: SITE_ORIGIN + "/stories/article.html?id=" + encodeURIComponent(story.id),
    image: story.image || DEFAULT_IMAGE,
    imageAlt: cleanText(story.title, "Open Phu Quoc")
  };
}
async function placeMeta(url, env) {
  const id = url.searchParams.get("id");
  if (!id) return null;
  const [places, activities, visuals] = await Promise.all([
    readAssetJson(env, url, "/data/entities/places.json"),
    readAssetJson(env, url, "/data/entities/activities.json"),
    readAssetJson(env, url, "/data/visual-context.json")
  ]);
  const all = [...(places.entities || []), ...(activities.entities || [])];
  const entity = all.find(x => x.id === id || x.slug === id || x.legacy_id === id);
  if (!entity) return null;
  const visual = visuals?.places?.[entity.id] || {};
  const hero = pickVisualImage(visual);
  const key = entity.slug || entity.id;
  return {
    type: "article",
    title: cleanText(entity.name) + " - Open Phu Quoc",
    description: truncate(entity.what_it_is || entity.why_go || "Thông tin điểm đến Phú Quốc."),
    canonical: SITE_ORIGIN + "/places/detail.html?id=" + encodeURIComponent(key),
    image: hero?.url || DEFAULT_IMAGE,
    imageAlt: cleanText(hero?.alt || entity.name, "Open Phu Quoc")
  };
}
async function knowledgeMeta(url,env){
  const id=url.searchParams.get("id");
  if(!id)return null;
  const data=await readAssetJson(env,url,"/data/views/knowledge-public.json");
  const article=(data.objects||[]).find(o=>o.topic_id===id);
  if(!article)return null;
  return {
    type:"article",
    title:cleanText(article.title)+" - Cẩm nang Phú Quốc",
    description:truncate(article.editorial.short_summary),
    canonical:SITE_ORIGIN+article.route,
    image:DEFAULT_IMAGE,
    imageAlt:"Open Phu Quoc"
  };
}
function transformMeta(response, meta) {
  const rewriter = new HTMLRewriter()
    .on("title", {
      element(el) { el.setInnerContent(meta.title); }
    })
    .on('link[rel="canonical"]', {
      element(el) { el.setAttribute("href", meta.canonical); }
    })
    .on('meta[name="description"]', {
      element(el) { el.setAttribute("content", meta.description); }
    })
    .on('meta[property="og:type"]', {
      element(el) { el.setAttribute("content", meta.type); }
    })
    .on('meta[property="og:title"]', {
      element(el) { el.setAttribute("content", meta.title); }
    })
    .on('meta[property="og:description"]', {
      element(el) { el.setAttribute("content", meta.description); }
    })
    .on('meta[property="og:url"]', {
      element(el) { el.setAttribute("content", meta.canonical); }
    })
    .on('meta[property="og:image"]', {
      element(el) { el.setAttribute("content", meta.image); }
    })
    .on('meta[property="og:image:alt"]', {
      element(el) { el.setAttribute("content", meta.imageAlt); }
    })
    .on('meta[property="og:image:width"],meta[property="og:image:height"]', {
      element(el) { el.remove(); }
    })
    .on('meta[name="twitter:card"]', {
      element(el) { el.setAttribute("content", "summary_large_image"); }
    })
    .on('meta[name="twitter:title"]', {
      element(el) { el.setAttribute("content", meta.title); }
    })
    .on('meta[name="twitter:description"]', {
      element(el) { el.setAttribute("content", meta.description); }
    })
    .on('meta[name="twitter:image"]', {
      element(el) { el.setAttribute("content", meta.image); }
    });
  return rewriter.transform(response);
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path === "/api/weather/live/feedback" && request.method === "POST") return cmsWeatherFeedbackPost({request,env});
    if (path === "/api/weather/live/feedback/recent" && request.method === "GET") return cmsWeatherFeedbackRecent({request,env});
    if (request.method !== "GET" && request.method !== "HEAD") {
      return env.ASSETS.fetch(request);
    }
    const url = new URL(request.url);
    let meta = null;
    try {
      if (url.pathname === "/stories/article.html") meta = await storyMeta(url, env);
      else if (url.pathname === "/places/detail.html") meta = await placeMeta(url, env);
      else if (url.pathname === "/guide/article.html") meta = await knowledgeMeta(url, env);
    } catch (error) {
      console.warn("social metadata lookup failed", error);
    }

    const assetUrl = new URL(url.pathname, request.url);
    const assetResponse = await env.ASSETS.fetch(new Request(assetUrl, request));
    if (!meta || !assetResponse.ok || !(assetResponse.headers.get("content-type") || "").includes("text/html")) {
      return assetResponse;
    }
    return transformMeta(assetResponse, meta);
  }
};
