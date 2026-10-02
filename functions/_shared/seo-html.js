import {DEFAULT_LOCALE,canonicalFor,hreflang,localizedPath,alternateSet,publishedLocales,localeCanServe} from "./i18n.js";
// HTML returned to crawlers and visitors includes the same published body as the client reader.
// No private editorial/research source is loaded here.
export const SEO_ORIGIN="https://openphuquoc.com";
export const SEO_FALLBACK_IMAGE=SEO_ORIGIN+"/assets/share-card-phu-quoc-v3.jpg";
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const clean=v=>String(v??"").replace(/\s+/g," ").trim();
const desc=v=>clean(v).slice(0,158);
const urlFor=(path)=>SEO_ORIGIN+path;
const safeImage=url=>typeof url==="string"&&(/^\//.test(url)&&!/^\/\//.test(url)||/^https:\/\//i.test(url))?url:null;
const dateValue=v=>typeof v==="string"&&/^\d{4}-\d{2}-\d{2}/.test(v)?v.slice(0,10):undefined;
const paras=v=>String(v??"").trim().split(/\n{2,}/).filter(Boolean).map(s=>"<p>"+esc(s).replace(/\n/g,"<br>")+"</p>").join("");
const photo=(src,alt,caption,credit)=>safeImage(src)
  ?'<figure><img src="'+esc(src)+'" alt="'+esc(alt||"Ảnh Phú Quốc")+'" loading="lazy" decoding="async">'+
    (caption||credit?'<figcaption>'+esc([caption,credit].filter(Boolean).join(" · "))+'</figcaption>':"")+"</figure>":"";
const uiText=(ui,path,fallback)=>{const value=String(path||"").split(".").reduce((o,k)=>o?.[k],ui);return typeof value==="string"&&value?value:fallback};
function alternateMeta(path,availableLocales=[]){
  if(!Array.isArray(availableLocales)||availableLocales.length<2)return[];
  return alternateSet(path,availableLocales).map(row=>({...row,href:new URL(row.path,SEO_ORIGIN).toString()}));
}
function languageHref(pathname,code){
  const source=new URL(pathname,SEO_ORIGIN);
  const target=new URL(localizedPath(source.pathname,code),SEO_ORIGIN);
  for(const [key,value] of source.searchParams)if(key!=="lang")target.searchParams.append(key,value);
  target.searchParams.set("lang",code);
  return target.pathname+target.search;
}
function languageSwitcher(pathname,locale){
  const route=new URL(pathname,SEO_ORIGIN).pathname;
  const published=new Set(publishedLocales().map(x=>x.code));
  const codes=["vi","en"].filter(code=>published.has(code)&&localeCanServe(code,route));
  if(codes.length<2)return"";
  const links=codes.map(code=>'<a href="'+esc(languageHref(pathname,code))+'" lang="'+esc(hreflang(code))+'"'+(code===locale?' aria-current="page"':"")+'>'+code.toUpperCase()+'</a>').join("");
  return '<nav class="opq-language-auto" data-openpq-language-switcher-auto data-openpq-language-switcher-server aria-label="Language"><span class="opq-language-label">Language</span><div class="opq-language-options">'+links+'</div></nav>';
}
const SHELL_LANGUAGE_SELECTOR_ROUTES=new Set(["/","/weather/","/transit/","/airport/"]);
export function shellOwnsLanguageSelector(pathname){
  let route=new URL(pathname||"/",SEO_ORIGIN).pathname;
  if(route.endsWith("/index.html"))route=route.slice(0,-10)||"/";
  if(route!=="/"&&!route.endsWith("/"))route+="/";
  return SHELL_LANGUAGE_SELECTOR_ROUTES.has(route);
}
const LANGUAGE_SWITCHER_STYLE='body > .opq-language-auto{position:fixed;top:10px;right:62px;z-index:1000}.opq-language-auto{display:flex;align-items:center;gap:6px;margin-left:auto;padding:4px;border:1px solid rgba(23,42,48,.14);border-radius:999px;background:rgba(255,255,255,.96);font:700 12px/1.2 system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;white-space:nowrap;flex:0 0 auto;z-index:30}.opq-language-auto[hidden]{display:none}.opq-language-auto .opq-language-label{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.opq-language-options{display:flex;gap:2px}.opq-language-options a{display:inline-flex;align-items:center;justify-content:center;min-width:38px;min-height:32px;padding:0 8px;border-radius:999px;color:#233239;text-decoration:none}.opq-language-options a[aria-current=page]{background:#edf4f1;color:#0b5d4b}.opq-language-options a:focus-visible{outline:2px solid currentColor;outline-offset:2px}@media(max-width:760px){.opq-language-auto{order:8;margin-left:auto;margin-right:4px}.opq-language-options a{min-width:40px;min-height:36px;padding:0 8px}}';
export function buildStoryMeta(story,{locale=DEFAULT_LOCALE,availableLocales=[DEFAULT_LOCALE]}={}){
  if(!story?.id||!story.title)return null;
  const path="/stories/article.html?id="+encodeURIComponent(story.id);
  return {kind:"story",source:story,type:"article",locale,htmlLang:hreflang(locale),path,
    title:clean(story.title)+" - Open Phu Quoc",
    description:desc(story.dek||story.intro||"Câu chuyện về Phú Quốc."),
    canonical:canonicalFor(path,locale,SEO_ORIGIN),alternates:alternateMeta(path,availableLocales),
    image:safeImage(story.image)||SEO_FALLBACK_IMAGE,imageAlt:clean(story.image_alt||story.title)};
}
export function buildKnowledgeMeta(article,{locale=DEFAULT_LOCALE,availableLocales=[DEFAULT_LOCALE],ui=null}={}){
  if(!article?.topic_id||!article.title||!article.editorial)return null;
  const path=article.route||"/guide/article.html?id="+encodeURIComponent(article.topic_id);
  return {kind:"knowledge",source:article,type:"article",locale,htmlLang:hreflang(locale),path,ui,
    title:clean(article.title)+" - Cẩm nang Phú Quốc",
    description:desc(article.editorial.short_summary),
    canonical:canonicalFor(path,locale,SEO_ORIGIN),alternates:alternateMeta(path,availableLocales),
    image:safeImage(article.media?.images?.[0]?.url)||SEO_FALLBACK_IMAGE,
    imageAlt:clean(article.media?.images?.[0]?.alt||article.title)};
}
export function storyBody(s){
  let out='<article class="article" itemscope itemtype="https://schema.org/Article"><header class="article-masthead"><div class="article-head-copy">'+
    '<p>'+esc(s.category||"Câu chuyện Phú Quốc")+'</p><h1 itemprop="headline">'+esc(s.title)+'</h1>'+
    paras(s.dek)+paras(s.intro)+'</div>'+
    photo(s.image,s.image_alt||s.title,s.image_caption,s.image_credit)+'</header>';
  for(const section of s.sections||[]){
    out+='<section class="article-section">'+(section.heading?'<h2>'+esc(section.heading)+'</h2>':"")+
      photo(section.image,section.caption||section.heading,section.caption,"")+
      paras(section.body)+'</section>';
  }
  return out+"</article>";
}
export function knowledgeBody(o,locale=DEFAULT_LOCALE,ui=null){
  const ed=o.editorial||{};
  const type=o.topic_type||"";
  const fallbackHeadings={
    PLACE:["Ghé thế nào cho tiện?","Điều nên biết trước khi tới","Trước khi ghé"],
    NATURE:["Xem điều kiện thực tế","Những điều dễ bỏ sót","Khi ra ngoài"],
    FOOD:["Ăn và chọn món","Điều cần biết khi gọi","Trước khi ăn hoặc mua"],
    PRACTICAL:["Chuẩn bị thế nào?","Những trường hợp cần lưu ý","Trước khi đi"],
    HISTORY_LORE:["Tìm hiểu thêm","Hiểu đúng câu chuyện","Nếu ghé thăm"],
    ACTIVITY:["Sắp lịch thế nào?","Điều có thể khác dự tính","Trước chuyến đi"],
    MEMORY_CHANGE:["Nhìn đảo hôm nay","Đọc tư liệu đúng thời điểm","Nếu muốn xem tận nơi"]
  };
  const fb=fallbackHeadings[type]||["Điều nên biết","Đọc thêm","Trước khi đi"];
  const headings=[
    uiText(ui,"knowledge.headings."+type+".practical",fb[0]),
    uiText(ui,"knowledge.headings."+type+".reality",fb[1]),
    uiText(ui,"knowledge.headings."+type+".before",fb[2])
  ];
  if(type==="FOOD"&&[64,65,66,67,68].includes(o.number))headings[0]=uiText(ui,"knowledge.headings.FOOD.buy","Chọn mua và tìm hiểu");
  let out='<article class="knowledge-article" itemscope itemtype="https://schema.org/Article">'+
    '<a class="knowledge-back" href="'+esc(localizedPath("/guide/knowledge.html",locale))+'">'+esc(uiText(ui,"knowledge.back_all","← Tất cả bài cẩm nang"))+'</a>'+
    '<h1 itemprop="headline">'+esc(o.title)+'</h1><p class="knowledge-lead">'+esc(ed.short_summary||"")+'</p>';
  const photographs=(o.media?.images||[]).filter(p=>safeImage(p.url));
  if(photographs.length){
    out+='<div class="knowledge-article-photos'+(photographs.length===1?" single":"")+'">';
    for(const p of photographs)out+=photo(p.url,p.alt||o.title,p.caption,p.credit);
    out+="</div>";
  }
  for(const [heading,value] of [[headings[0],ed.practical],[headings[1],ed.expectation_vs_reality]]){
    if(value)out+='<section><h2>'+esc(heading)+'</h2>'+paras(value)+'</section>';
  }
  if(ed.before_you_go?.length){
    out+='<section><h2>'+esc(headings[2])+'</h2><ul>';
    for(const item of ed.before_you_go)out+="<li>"+esc(item)+"</li>";
    out+="</ul></section>";
  }
  if(o.links?.length){
    out+='<aside class="knowledge-further"><h2>'+esc(uiText(ui,"knowledge.further","Tìm hiểu thêm"))+'</h2>';
    for(const link of o.links)if(/^https:\/\//.test(link.url||""))
      out+='<a href="'+esc(link.url)+'" rel="noopener noreferrer" target="_blank">'+esc(link.label||uiText(ui,"knowledge.source","Nguồn thông tin"))+'</a>';
    out+="</aside>";
  }
  return out+"</article>";
}
export function structured(meta){
  if(meta.kind!=="story"&&meta.kind!=="knowledge")return null;
  const org={"@type":"Organization","@id":SEO_ORIGIN+"/#organization",name:"Open Phu Quoc",url:SEO_ORIGIN+"/",
    logo:{"@type":"ImageObject",url:SEO_ORIGIN+"/assets/logo-master.png"}};
  const obj={"@context":"https://schema.org","@type":"Article",headline:meta.source.title,
    description:meta.description,mainEntityOfPage:{"@type":"WebPage","@id":meta.canonical},
    inLanguage:meta.htmlLang||"vi-VN",author:org,publisher:org};
  const published=dateValue(meta.source.published_at||meta.source.publication_date);
  if(published)obj.datePublished=published; // Never invent an editorial publication date.
  const d=dateValue(meta.source.updated_at);
  if(d)obj.dateModified=d;
  if(safeImage(meta.image))obj.image=[new URL(meta.image,SEO_ORIGIN).toString()];
  return JSON.stringify(obj).replace(/</g,"\\u003c");
}
export function rewriteSeoHtml(response,meta){
  if(!meta||!response.ok||!(response.headers.get("content-type")||"").includes("text/html"))return response;
  const writer=new HTMLRewriter()
    .on("html",{element(el){if(meta.htmlLang)el.setAttribute("lang",meta.htmlLang)}})
    .on("title",{element(el){el.setInnerContent(meta.title)}})
    .on('link[rel="canonical"]',{element(el){el.setAttribute("href",meta.canonical)}})
    .on('meta[name="description"]',{element(el){el.setAttribute("content",meta.description)}})
    .on('meta[property="og:type"]',{element(el){el.setAttribute("content",meta.type)}})
    .on('meta[property="og:title"]',{element(el){el.setAttribute("content",meta.title)}})
    .on('meta[property="og:description"]',{element(el){el.setAttribute("content",meta.description)}})
    .on('meta[property="og:url"]',{element(el){el.setAttribute("content",meta.canonical)}})
    .on('meta[property="og:image"]',{element(el){el.setAttribute("content",meta.image)}})
    .on('meta[property="og:image:alt"]',{element(el){el.setAttribute("content",meta.imageAlt)}})
    .on('meta[property="og:image:type"]',{element(el){el.setAttribute("content",meta.image.endsWith(".svg")?"image/svg+xml":"image/jpeg")}})
    .on('meta[property="og:image:width"],meta[property="og:image:height"]',{element(el){el.remove()}})
    .on('meta[name="twitter:card"]',{element(el){el.setAttribute("content","summary_large_image")}})
    .on('meta[name="twitter:title"]',{element(el){el.setAttribute("content",meta.title)}})
    .on('meta[name="twitter:description"]',{element(el){el.setAttribute("content",meta.description)}})
    .on('meta[name="twitter:image"]',{element(el){el.setAttribute("content",meta.image)}});
  if(meta.kind==="story"||meta.kind==="knowledge"){
    writer.on(meta.kind==="story"?"#articleRoot":"#knowledgeArticle",{
      element(el){el.setInnerContent(meta.kind==="story"?storyBody(meta.source):knowledgeBody(meta.source,meta.locale,meta.ui),{html:true})}
    });
    writer.on("head",{element(el){
      const alternates=(meta.alternates||[]).map(x=>'<link rel="alternate" hreflang="'+esc(x.hreflang)+'" href="'+esc(x.href)+'">').join("");
      el.append(alternates+'<script type="application/ld+json">'+structured(meta)+'</script>',{html:true});
    }});
  }
  return writer.transform(response);
}
export function rewriteLocaleHtml(response,{locale=DEFAULT_LOCALE,pathname="/",availableLocales=[DEFAULT_LOCALE]}={}){
  if(!response.ok||!(response.headers.get("content-type")||"").includes("text/html"))return response;
  const canonical=canonicalFor(pathname,locale,SEO_ORIGIN);
  const alternates=alternateMeta(pathname,availableLocales);
  const shellOwnsSelector=shellOwnsLanguageSelector(pathname);
  const serverSwitcher=shellOwnsSelector?"":languageSwitcher(pathname,locale);
  const writer=new HTMLRewriter()
    .on("html",{element(el){el.setAttribute("lang",hreflang(locale))}})
    .on('link[rel="canonical"]',{element(el){el.setAttribute("href",canonical)}})
    .on("head",{element(el){
      const links=alternates.map(x=>'<link rel="alternate" hreflang="'+esc(x.hreflang)+'" href="'+esc(x.href)+'">').join("");
      el.append('<meta name="openpq-locale" content="'+esc(locale)+'">'+links+
        (serverSwitcher?'<style id="openpq-language-switcher-style">'+LANGUAGE_SWITCHER_STYLE+'</style>':"")+
        '<script src="/core/i18n-runtime.js?v=4" defer data-openpq-i18n-runtime></script>'+
        (locale==="en"?'<script src="/core/en-full-site.js?v=2" defer data-openpq-en-full-site></script>':"")+
        (!shellOwnsSelector?'<script src="/core/language-switcher.js?v=4" defer data-openpq-language-switcher></script>':""),{html:true});
    }})
    .on("body",{element(el){
      if(serverSwitcher)el.prepend(serverSwitcher,{html:true});
    }});
  return writer.transform(response);
}
