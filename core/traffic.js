(()=>{"use strict";
const endpoint="/api/traffic/collect",valid=()=>location.hostname==="cms.openphuquoc.com"||location.hostname==="localhost"||location.hostname.endsWith(".workers.dev")||location.hostname.endsWith(".pages.dev");
if(!valid()||location.pathname.startsWith("/admin/")||location.pathname.startsWith("/api/"))return;
const pathname=()=>location.pathname.replace(/\/index\.html$/,"/")+(new URLSearchParams(location.search).get("id")?"?id="+encodeURIComponent(new URLSearchParams(location.search).get("id")):"");
function device(){return window.innerWidth<680?"mobile":window.innerWidth<1024?"tablet":"desktop"}
function referrer(){try{return document.referrer?new URL(document.referrer).hostname:""}catch{return""}}
const once=new Set();
function send(event,dedupe=false){
 const path=pathname();
 if(dedupe&&once.has(event+path))return;
 if(dedupe)once.add(event+path);
 const payload=JSON.stringify({event,path,device:device(),referrer:referrer()});
 if(navigator.sendBeacon){
   try{if(navigator.sendBeacon(endpoint,new Blob([payload],{type:"application/json"})))return}catch{}
 }
 fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:payload,credentials:"same-origin",keepalive:true}).catch(()=>{});
}
function eventFor(el){
 if(el.closest("[data-openpq-feedback]"))return "feedback_open";
 const anchor=el.closest("a[href]");
 if(!anchor)return null;
 let path;try{const u=new URL(anchor.href,location.href);if(u.origin!==location.origin)return null;path=u.pathname}catch{return null}
 if(path==="/go/"||path==="/go/index.html")return"go_open";
 if(path==="/nearme/"||path==="/nearme/index.html")return"nearme_open";
 if(path==="/weather/"||path==="/weather/index.html")return"weather_open";
 if(path==="/airport/"||path==="/airport/index.html")return"airport_open";
 if(path==="/transit/"||path==="/transit/index.html")return"transit_open";
 return null;
}
document.addEventListener("click",e=>{if(!(e.target instanceof Element))return;const type=eventFor(e.target);if(type)send(type)},true);
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>send("page_view",true),{once:true});
else send("page_view",true);
})();