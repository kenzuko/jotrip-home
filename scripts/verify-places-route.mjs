// Read-only, authenticated route inventory. Never assume that matching page
// content proves the temporary Cloudflare routing rule was actually detached.
import {appendFile} from "node:fs/promises";
const mode=process.argv[2];
if(!["before","after"].includes(mode))throw Error("Usage: verify-places-route.mjs before|after");
const token=String(process.env.CLOUDFLARE_API_TOKEN||"").trim();
if(!token)throw Error("Cloudflare route inventory unavailable: token missing");
const headers={Authorization:"Bearer "+token,Accept:"application/json"};
async function api(url){
  const res=await fetch("https://api.cloudflare.com/client/v4"+url,{headers,signal:AbortSignal.timeout(18000)});
  const value=await res.json();
  if(!res.ok||!value.success)throw Error("Cloudflare route inventory HTTP "+res.status+
    " (inspect token Zone Read permission, no route changes applied)");
  return value.result||[];
}
const zones=await api("/zones?name=openphuquoc.com&per_page=20");
if(zones.length!==1)throw Error("Expected exactly one openphuquoc.com zone, got "+zones.length);
const routes=await api("/zones/"+encodeURIComponent(zones[0].id)+"/workers/routes");
const matches=routes.filter(r=>String(r.pattern||"").toLowerCase()==="openphuquoc.com/places*");
if(mode==="before"){
  if(matches.some(r=>r.script!=="openpq-places-ui-hotfix"))
    throw Error("The Places route belongs to another Worker; do not modify it");
  if(matches.length>1)throw Error("Ambiguous duplicate Places rules; manual review required");
  if(process.env.GITHUB_OUTPUT)
    await appendFile(process.env.GITHUB_OUTPUT,"route_present="+(matches.length?"true":"false")+"\n");
  console.log("Cloudflare Places route preflight OK, temporary rule count",matches.length);
}else{
  if(matches.length)throw Error("The temporary /places route is still present after detach");
  console.log("Cloudflare inventory confirms temporary /places route is absent");
}
