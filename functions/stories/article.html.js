import {buildStoryMeta,rewriteSeoHtml} from "../_shared/seo-html.js";
export async function onRequestGet({request,env}){
  const url=new URL(request.url),id=url.searchParams.get("id");
  if(!id)return env.ASSETS.fetch(new Request(new URL("/stories/article",url)));
  try{
    const response=await env.ASSETS.fetch(new Request(new URL("/data/content.json",url)));
    if(!response.ok)throw Error("Story asset unavailable");
    const story=(await response.json()).stories?.find(o=>o.id===id&&!["draft","pending","review","scheduled"].includes(o.status));
    if(!story)return new Response("Không tìm thấy bài viết.",{status:404,headers:{"Content-Type":"text/plain; charset=utf-8"}});
    const asset=await env.ASSETS.fetch(new Request(new URL("/stories/article",url)));
    return rewriteSeoHtml(asset,buildStoryMeta(story));
  }catch(error){console.warn("Story SEO fallback",error);return env.ASSETS.fetch(new Request(new URL("/stories/article",url)));}
}
