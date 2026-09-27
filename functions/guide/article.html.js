import {buildKnowledgeMeta,rewriteSeoHtml} from "../_shared/seo-html.js";
export async function onRequestGet({request,env}){
  const url=new URL(request.url),id=url.searchParams.get("id");
  if(!id)return env.ASSETS.fetch(new Request(new URL("/guide/article.html",url)));
  try{
    const response=await env.ASSETS.fetch(new Request(new URL("/data/views/knowledge-public.json",url)));
    if(!response.ok)throw Error("Knowledge asset unavailable");
    const article=(await response.json()).objects?.find(o=>o.topic_id===id);
    if(!article)return new Response("Không tìm thấy bài viết.",{status:404,headers:{"Content-Type":"text/plain; charset=utf-8"}});
    const asset=await env.ASSETS.fetch(new Request(new URL("/guide/article.html",url)));
    return rewriteSeoHtml(asset,buildKnowledgeMeta(article));
  }catch(error){console.warn("Knowledge SEO fallback",error);return env.ASSETS.fetch(new Request(new URL("/guide/article.html",url)));}
}
