const PUBLIC_HOST="openphuquoc.com";
const CMS_HOST="cms.openphuquoc.com";
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
  return PUBLIC_PREFIXES.some(prefix=>pathname.startsWith(prefix));
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
  const url=new URL(request.url);
  if(url.hostname.toLowerCase()!==CMS_HOST)return context.next();
  if(!["GET","HEAD"].includes(request.method))return context.next();
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
