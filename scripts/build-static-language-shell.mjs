import {readFileSync,writeFileSync,existsSync} from "node:fs";
import {join} from "node:path";

const root=process.env.OPENPQ_DIST||"dist";
const routes=JSON.parse(readFileSync(join(root,"data/i18n/routes.json"),"utf8"));
const locales=JSON.parse(readFileSync(join(root,"data/i18n/locales.json"),"utf8"));
const published=(locales.locales||[]).filter(x=>x.published);
const byCode=new Map(published.map(x=>[x.code,x]));
const staticCodes=(routes.rules?.static_selector_locales||[]).filter(code=>byCode.has(code));
const defaultCode=locales.default_locale||routes.default_locale||"vi";
if(!staticCodes.includes(defaultCode))throw new Error("Static selector must include default locale");
if(staticCodes.length<2)throw new Error("Static selector needs at least two published locales");

const esc=value=>String(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const localePath=(path,code)=>{
  const row=byCode.get(code);
  if(!row)throw new Error("Unpublished locale in selector: "+code);
  if(code===defaultCode)return path;
  return "/"+row.url_code+(path==="/"?"/":path);
};
const label=code=>code==="vi"?"VI":code==="en"?"EN":code.toUpperCase();

const style=`<style id="openpq-static-language-style">
.opq-static-language{display:flex;align-items:center;gap:2px;margin-left:auto;padding:3px;border:1px solid rgba(23,42,48,.14);border-radius:999px;background:rgba(255,255,255,.96);font:700 12px/1.2 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;white-space:nowrap;flex:0 0 auto;z-index:35}
.opq-static-language a{display:inline-flex;align-items:center;justify-content:center;min-width:36px;min-height:30px;padding:0 7px;border-radius:999px;color:#233239;text-decoration:none}
html[lang^="vi"] .opq-static-language a[data-openpq-lang="vi"],html[lang^="en"] .opq-static-language a[data-openpq-lang="en"]{background:#edf4f1;color:#0b5d4b}
.opq-static-language a:focus-visible{outline:2px solid currentColor;outline-offset:2px}
.opq-static-language[data-openpq-language-placement="after-header"]{width:max-content;max-width:calc(100% - 24px);margin:6px 12px 6px auto}
.opq-language-auto{display:none!important}
@media(max-width:760px){.opq-static-language{padding:2px;gap:1px}.opq-static-language a{min-width:34px;min-height:32px;padding:0 6px;font-size:11px}.opq-static-language[data-openpq-language-placement="after-header"]{margin-top:5px;margin-bottom:5px}}
</style>`;

function bootstrap(route){
  const viPath=localePath(route.path,"vi"),enPath=localePath(route.path,"en");
  const selectable=staticCodes.map(code=>{const row=byCode.get(code);return {code:row.code,url_code:row.url_code}});
  return `<script id="openpq-static-language-bootstrap">(()=>{try{const K="${esc(routes.rules?.manual_preference_key||"openpq_lang")}",D="${esc(defaultCode)}",R=${JSON.stringify(selectable)},VI=${JSON.stringify(viPath)},EN=${JSON.stringify(enPath)};const explicit=/^\\/en(?:\\/|$)/.test(location.pathname)?"en":"";const cookie=()=>{const m=("; "+document.cookie).match(new RegExp("; "+K+"=([^;]*)"));return m?decodeURIComponent(m[1]):""};const save=c=>{try{localStorage.setItem(K,c)}catch{};document.cookie=K+"="+encodeURIComponent(c)+"; Max-Age=31536000; Path=/; SameSite=Lax; Secure"};const cleanQuery=()=>{const q=new URLSearchParams(location.search);q.delete("lang");return q};const target=href=>{const u=new URL(href,location.href),q=cleanQuery();u.search=q.toString()?"?"+q.toString():"";u.hash=location.hash;return u.pathname+u.search+u.hash};const replace=href=>{const next=target(href);if(next!==location.pathname+location.search+location.hash)location.replace(next)};const routeFor=c=>c==="en"?EN:c===D?VI:"";const syncLinks=()=>document.querySelectorAll('[data-openpq-language-static] [data-openpq-lang]').forEach(a=>{const raw=a.getAttribute("data-openpq-target")||a.getAttribute("href");if(raw)a.setAttribute("href",target(raw))});if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",syncLinks,{once:true});else syncLinks();document.addEventListener("click",e=>{const a=e.target.closest?.("[data-openpq-lang]");if(!a)return;const c=a.getAttribute("data-openpq-lang");if(!R.some(x=>x.code===c))return;save(c);if(e.button===0&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey){e.preventDefault();location.assign(target(a.getAttribute("data-openpq-target")||a.href))}},true);const legacy=new URLSearchParams(location.search).get("lang")||"";if(R.some(x=>x.code===legacy)){save(legacy);const dest=routeFor(legacy);if(dest&&legacy!==D){replace(dest);return}if(legacy===D&&location.pathname!==VI){replace(VI);return}const q=cleanQuery();history.replaceState(history.state,"",VI+(q.toString()?"?"+q.toString():"")+location.hash);return}if(explicit&&explicit!==D)return;let pref="";try{pref=localStorage.getItem(K)||""}catch{};pref=pref||cookie();if(R.some(x=>x.code===pref)){const dest=routeFor(pref);if(dest&&pref!==D)replace(dest);return}const tags=navigator.languages?.length?navigator.languages:[navigator.language||""];let browser="";for(const tag of tags){const raw=String(tag||"").toLowerCase(),base=raw.split("-")[0];const hit=R.find(x=>x.code.toLowerCase()===raw||x.code.toLowerCase()===base||x.url_code.toLowerCase()===raw||x.url_code.toLowerCase()===base);if(hit){browser=hit.code;break}}const dest=routeFor(browser);if(dest&&browser&&browser!==D){replace(dest);return}}catch{}})();</script>`;
}

function nav(route){
  const placement=route.placement||"before-header-end";
  const links=staticCodes.map(code=>{
    const target=localePath(route.path,code);
    const href=route.query_sensitive?"#language-"+code:target;
    const targetAttr=route.query_sensitive?` data-openpq-target="${esc(target)}"`:"";
    return `<a href="${esc(href)}"${targetAttr} hreflang="${esc(byCode.get(code).html_lang||code)}" lang="${esc(byCode.get(code).html_lang||code)}" data-openpq-lang="${esc(code)}">${esc(label(code))}</a>`;
  }).join("");
  return `<nav class="opq-static-language" data-openpq-language-static data-openpq-language-placement="${esc(placement)}" aria-label="Language">${links}</nav>`;
}
function alternates(route){
  if(route.alternates===false)return"";
  const links=staticCodes.map(code=>`<link rel="alternate" hreflang="${esc(byCode.get(code).html_lang||code)}" href="https://openphuquoc.com${esc(localePath(route.path,code))}">`).join("");
  return links+`<link rel="alternate" hreflang="x-default" href="https://openphuquoc.com${esc(route.path)}">`;
}
function insertEarlyBootstrap(html,script){
  if(!script)return html;
  const head=/<head\b[^>]*>/i.exec(html);
  if(!head)return html;
  const headStart=head.index+head[0].length;
  const charset=/<meta\s+charset=[^>]*>/i.exec(html.slice(headStart));
  const at=charset?headStart+charset.index+charset[0].length:headStart;
  return html.slice(0,at)+script+html.slice(at);
}

let built=0,native=0;
for(const route of routes.static_shells||[]){
  const file=join(root,route.file);
  if(!existsSync(file))throw new Error("i18n route file missing: "+route.file);
  if(route.selector==="native"){native++;continue}
  if(route.selector!=="static")throw new Error("Unknown selector mode for "+route.path+": "+route.selector);
  let html=readFileSync(file,"utf8");
  if(html.includes("data-openpq-language-static"))throw new Error("Static language selector already present: "+route.file);
  html=insertEarlyBootstrap(html,route.autodetect?bootstrap(route):"");
  const headClose=html.indexOf("</head>");
  const headerClose=html.indexOf("</header>");
  if(headClose<0||headerClose<0)throw new Error("Static language insertion point missing: "+route.file);
  html=html.slice(0,headClose)+alternates(route)+style+html.slice(headClose);
  const placement=route.placement||"before-header-end";
  const nextHeaderClose=html.indexOf("</header>");
  if(placement==="after-header"){
    const end=nextHeaderClose+"</header>".length;
    html=html.slice(0,end)+nav(route)+html.slice(end);
  }else if(placement==="before-header-end"){
    html=html.slice(0,nextHeaderClose)+nav(route)+html.slice(nextHeaderClose);
  }else throw new Error("Unknown language selector placement for "+route.path+": "+placement);
  writeFileSync(file,html,"utf8");
  built++;
}
console.log(`Static language shell ready: ${built} static selector page(s), ${native} native selector page(s)`);
