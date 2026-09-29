const PUBLIC_HOST="openphuquoc.com";
const CMS_HOST="cms.openphuquoc.com";
const LEGACY_PAGES_HOST="jotrip-home.pages.dev";
const SESSION_COOKIE="openpq_cms";

const PUBLIC_PREFIXES=[
  "/about/","/airport/","/bus/","/cano/","/currency/","/explore/","/ferry/",
  "/food/","/go/","/guide/","/hotels/","/nearme/","/news/","/places/",
  "/stories/","/transit/","/utilities/","/weather/"
];

const INTERNAL_PREFIXES=[
  "/admin/","/api/","/assets/","/core/","/data/","/cms/","/.well-known/"
];

function hasCookie(request,name){
  const raw=request.headers.get("cookie")||"";
  return raw.split(";").some(part=>part.trim().startsWith(name+"="));
}

function isInternal(pathname){
  return INTERNAL_PREFIXES.some(prefix=>pathname.startsWith(prefix));
}

function isPublicPage(pathname){
  if(pathname==="/"||pathname==="/index.html")return true;
  if(isInternal(pathname))return false;
  if(pathname.startsWith("/weather/data/"))return false;
  return PUBLIC_PREFIXES.some(prefix=>pathname===prefix.slice(0,-1)||pathname.startsWith(prefix));
}

function canonicalTarget(url){
  const next=new URL(url.toString());
  next.protocol="https:";
  next.hostname=PUBLIC_HOST;
  next.port="";
  return next;
}

export async function onRequest(context){
  const {request}=context;
  const url=new URL(request.url),host=url.hostname.toLowerCase();
  if(!["GET","HEAD"].includes(request.method))return context.next();

  // The production Pages hostname is a legacy public origin. Redirect only that
  // exact hostname; branch preview hostnames remain usable for QA.
  if(host===LEGACY_PAGES_HOST&&isPublicPage(url.pathname)){
    return new Response(null,{status:301,headers:{
      "Location":canonicalTarget(url).toString(),
      "Cache-Control":"public, max-age=3600",
      "X-Robots-Tag":"noindex, nofollow, noarchive"
    }});
  }

  if(host!==CMS_HOST)return context.next();
  if(!isPublicPage(url.pathname))return context.next();

  // Authenticated CMS users keep the same-origin editing surface.
  if(hasCookie(request,SESSION_COOKIE)){
    const response=await context.next();
    const headers=new Headers(response.headers);
    headers.set("X-Robots-Tag","noindex, nofollow, noarchive");
    headers.set("Cache-Control","private, no-store");
    headers.append("Vary","Cookie");
    return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  }

  const headers=new Headers({
    "Location":canonicalTarget(url).toString(),
    "Cache-Control":"private, no-store",
    "X-Robots-Tag":"noindex, nofollow, noarchive"
  });
  return new Response(null,{status:301,headers});
}

export const __test={hasCookie,isInternal,isPublicPage,canonicalTarget};
