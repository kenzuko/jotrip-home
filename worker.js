import {buildStoryMeta,buildKnowledgeMeta,rewriteSeoHtml} from "./functions/_shared/seo-html.js";
import {cleanupFeedback} from "./functions/_shared/place-feedback.js";
import {collectTraffic} from "./functions/_shared/traffic-analytics.js";
import {onRequest as ownerTrafficReport} from "./functions/api/cms/traffic.js";
import {onRequest as publicFeedback} from "./functions/api/feedback.js";
import {onRequest as adminPlaceFeedback} from "./functions/api/cms/feedback.js";
import {onRequest as adminPlaceFeedbackPhoto} from "./functions/api/cms/feedback/photo.js";
import {onRequestPost as cmsWeatherFeedbackPost} from "./functions/api/weather/live/feedback.js";
import {onRequestGet as cmsWeatherFeedbackRecent} from "./functions/api/weather/live/feedback/recent.js";
import {handleWeatherData,prewarmWeatherEdge} from "./functions/_shared/weather-edge.js";
import {handleWeatherWindow} from "./functions/_shared/weather-context.js";
import {handleGoLive} from "./functions/_shared/go-live.js";
import {captureWeatherAlerts,readWeatherAlertHistory} from "./functions/_shared/weather-alert-runtime.js";
const SITE_ORIGIN = "https://cms.openphuquoc.com";
const DEFAULT_IMAGE = SITE_ORIGIN + "/assets/share-card.svg";

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
  const story = (data.stories || []).find(x => x.id === id && !["draft","pending","review","scheduled"].includes(x.status));
  if (!story) return null;
  return buildStoryMeta(story);
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
  return buildKnowledgeMeta(article);
}

export default {
  async scheduled(event,env,ctx){
    ctx.waitUntil(prewarmWeatherEdge("https://openphuquoc-v3.kenzuko.workers.dev",p=>ctx.waitUntil(p)));
    if(env.CMS_DB)ctx.waitUntil(captureWeatherAlerts(env).catch(e=>console.warn("Weather alert audit retry next cron",e.message)));
    const tick=new Date(event.scheduledTime||Date.now());
    if(env.CMS_DB&&tick.getUTCHours()===20&&tick.getUTCMinutes()===0)
      ctx.waitUntil(cleanupFeedback(env).catch(e=>console.warn("Community feedback cleanup retry next day",e.message)));
  },
  async fetch(request, env, ctx) {
    const weatherPath=new URL(request.url).pathname;
    if(weatherPath==="/weather/data/alert-history.json"&&["GET","HEAD"].includes(request.method)){
      const result=await readWeatherAlertHistory(env);
      return request.method==="HEAD"?new Response(null,{status:result.status,headers:result.headers}):result;
    }
    if(weatherPath.startsWith("/weather/data/")||[
      "/weather/spatial-ecmwf.json","/weather/spatial-icon.json","/weather/spatial-marine.json"
    ].includes(weatherPath)){
      return handleWeatherData(request,()=>env.ASSETS.fetch(request),ctx? p=>ctx.waitUntil(p):undefined);
    }
    const path = new URL(request.url).pathname;
    if (path === "/api/context/v1/weather/window") return handleWeatherWindow(request);
    if (path === "/api/go/live") return handleGoLive(request);
    if (path === "/api/feedback") return publicFeedback({request,env});
    if (path === "/api/traffic/collect") return collectTraffic(request,env);
    if (path === "/api/cms/traffic") return ownerTrafficReport({request,env});
    if (path === "/api/cms/feedback") return adminPlaceFeedback({request,env});
    if (path === "/api/cms/feedback/photo") return adminPlaceFeedbackPhoto({request,env});
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
    return rewriteSeoHtml(assetResponse, meta);
  }
};
