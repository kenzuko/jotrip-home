import {buildStoryMeta,buildKnowledgeMeta,rewriteSeoHtml,rewriteLocaleHtml} from "./functions/_shared/seo-html.js";
import {DEFAULT_LOCALE,splitLocalePath,localeCanServe,publishedLocales} from "./functions/_shared/i18n.js";
import {mergeStory,mergeKnowledge} from "./functions/_shared/i18n-content.js";
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
const PUBLIC_ORIGIN = "https://openphuquoc.com";
const DEFAULT_IMAGE = PUBLIC_ORIGIN + "/assets/share-card.svg";

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
async function i18nCatalog(env,url){
  try{return await readAssetJson(env,url,"/data/i18n/catalog.json")}
  catch{return{locales:[{code:"vi",published:true}],availability:{stories:{vi:[]},knowledge:{vi:[]},food:{vi:[]}}}}
}
function availableLocales(catalog,kind,id){
  const published=new Set((catalog?.locales||[]).filter(x=>x.published).map(x=>x.code));
  return Object.entries(catalog?.availability?.[kind]||{})
    .filter(([code,ids])=>published.has(code)&&Array.isArray(ids)&&ids.includes(id))
    .map(([code])=>code);
}
async function storyMeta(url, env, locale=DEFAULT_LOCALE) {
  const id = url.searchParams.get("id");
  if (!id) return null;
  const [data,catalog]=await Promise.all([
    readAssetJson(env,url,"/data/content.json"),
    i18nCatalog(env,url)
  ]);
  const base = (data.stories || []).find(x => x.id === id && !["draft","pending","review","scheduled"].includes(x.status));
  if (!base) return null;
  let story=base;
  if(locale!==DEFAULT_LOCALE){
    let overlay;
    try{overlay=await readAssetJson(env,url,"/data/i18n/"+locale+"/stories.json")}catch{return null}
    const translated=(overlay.stories||[]).find(x=>x.id===id);
    story=mergeStory(base,translated);
    if(!story)return null;
  }
  return buildStoryMeta(story,{locale,availableLocales:availableLocales(catalog,"stories",id)});
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
    canonical: PUBLIC_ORIGIN + "/places/detail.html?id=" + encodeURIComponent(key),
    image: hero?.url || DEFAULT_IMAGE,
    imageAlt: cleanText(hero?.alt || entity.name, "Open Phu Quoc")
  };
}
async function knowledgeMeta(url,env,locale=DEFAULT_LOCALE){
  const id=url.searchParams.get("id");
  if(!id)return null;
  const [data,catalog]=await Promise.all([
    readAssetJson(env,url,"/data/views/knowledge-public.json"),
    i18nCatalog(env,url)
  ]);
  const base=(data.objects||[]).find(o=>o.topic_id===id);
  if(!base)return null;
  let article=base;
  let ui=null;
  if(locale!==DEFAULT_LOCALE){
    let overlay;
    try{
      [overlay,ui]=await Promise.all([
        readAssetJson(env,url,"/data/i18n/"+locale+"/knowledge.json"),
        readAssetJson(env,url,"/data/i18n/"+locale+"/ui.json")
      ]);
    }catch{return null}
    const translated=(overlay.objects||[]).find(x=>x.topic_id===id);
    article=mergeKnowledge(base,translated);
    if(!article)return null;
  }
  return buildKnowledgeMeta(article,{locale,availableLocales:availableLocales(catalog,"knowledge",id),ui});
}
function localizedUnavailable(){
  return new Response("Not Found",{status:404,headers:{"Content-Type":"text/plain; charset=utf-8","X-Robots-Tag":"noindex, nofollow","Cache-Control":"public, max-age=60"}});
}
function technicalLocalizedAsset(pathname){
  return /^\/(?:assets|core|data)\//.test(pathname)||
    /\.(?:js|css|json|png|jpe?g|webp|svg|ico|woff2?|map)$/i.test(pathname);
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
    const requestUrl=new URL(request.url);
    if(requestUrl.hostname.toLowerCase()==="www.openphuquoc.com"){
      const target=new URL(request.url);
      target.protocol="https:";
      target.hostname="openphuquoc.com";
      target.port="";
      return Response.redirect(target.toString(),301);
    }
    const localeRoute=splitLocalePath(requestUrl.pathname);
    if(localeRoute.defaultPrefixed){
      const target=new URL(request.url);
      target.pathname=localeRoute.pathname;
      return Response.redirect(target.toString(),301);
    }
    if(localeRoute.localized){
      if(!localeRoute.published)return localizedUnavailable();
      if(!technicalLocalizedAsset(localeRoute.pathname)&&!localeCanServe(localeRoute.locale,localeRoute.pathname))
        return localizedUnavailable();
    }
    const routedUrl=new URL(request.url);
    if(localeRoute.localized)routedUrl.pathname=localeRoute.pathname;
    const routedRequest=localeRoute.localized?new Request(routedUrl.toString(),request):request;
    const weatherPath=routedUrl.pathname;
    if(weatherPath==="/weather/data/alert-history.json"&&["GET","HEAD"].includes(request.method)){
      const result=await readWeatherAlertHistory(env);
      return request.method==="HEAD"?new Response(null,{status:result.status,headers:result.headers}):result;
    }
    if(weatherPath.startsWith("/weather/data/")||[
      "/weather/spatial-ecmwf.json","/weather/spatial-icon.json","/weather/spatial-marine.json"
    ].includes(weatherPath)){
      return handleWeatherData(routedRequest,()=>env.ASSETS.fetch(routedRequest),ctx? p=>ctx.waitUntil(p):undefined);
    }
    const path = routedUrl.pathname;
    if (path === "/api/context/v1/weather/window") return handleWeatherWindow(routedRequest);
    if (path === "/api/go/live") return handleGoLive(routedRequest);
    if (path === "/api/feedback") return publicFeedback({request:routedRequest,env});
    if (path === "/api/traffic/collect") return collectTraffic(routedRequest,env);
    if (path === "/api/cms/traffic") return ownerTrafficReport({request:routedRequest,env});
    if (path === "/api/cms/feedback") return adminPlaceFeedback({request:routedRequest,env});
    if (path === "/api/cms/feedback/photo") return adminPlaceFeedbackPhoto({request:routedRequest,env});
    if (path === "/api/weather/live/feedback" && request.method === "POST") return cmsWeatherFeedbackPost({request:routedRequest,env});
    if (path === "/api/weather/live/feedback/recent" && request.method === "GET") return cmsWeatherFeedbackRecent({request:routedRequest,env});
    if (request.method !== "GET" && request.method !== "HEAD") {
      return env.ASSETS.fetch(routedRequest);
    }
    const url = routedUrl;
    const locale=localeRoute.locale||DEFAULT_LOCALE;
    let meta = null;
    try {
      if (["/stories/article.html","/stories/article"].includes(url.pathname)) meta = await storyMeta(url, env, locale);
      else if (["/places/detail.html","/places/detail"].includes(url.pathname)) meta = locale===DEFAULT_LOCALE?await placeMeta(url, env):null;
      else if (["/guide/article.html","/guide/article"].includes(url.pathname)) meta = await knowledgeMeta(url, env, locale);
    } catch (error) {
      console.warn("social metadata lookup failed", error);
    }
    if(localeRoute.localized&&(["/stories/article.html","/stories/article","/guide/article.html","/guide/article"].includes(url.pathname))&&!meta)
      return localizedUnavailable();
    if(localeRoute.localized&&["/food/article.html","/food/article"].includes(url.pathname)){
      const id=url.searchParams.get("id");
      const catalog=await i18nCatalog(env,url);
      if(!id||!availableLocales(catalog,"food",id).includes(locale))return localizedUnavailable();
    }

    // Preserve the original query string when handing HTML to Static Assets.
    // Cloudflare may canonicalize *.html to extensionless paths; dropping ?id=
    // here makes the client article reader lose the requested record.
    const assetUrl = new URL(routedUrl);
    const assetResponse = await env.ASSETS.fetch(new Request(assetUrl.toString(), routedRequest));
    if(meta)return rewriteSeoHtml(assetResponse,meta);
    if(localeRoute.localized&&assetResponse.ok&&(assetResponse.headers.get("content-type")||"").includes("text/html")){
      const available=publishedLocales().filter(x=>localeCanServe(x.code,url.pathname)).map(x=>x.code);
      return rewriteLocaleHtml(assetResponse,{locale,pathname:url.pathname+url.search,availableLocales:available});
    }
    return assetResponse;
  }
};
