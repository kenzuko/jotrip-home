// Safety gate for the exact temporary Places route. No wildcard deletion,
// no script deletion, and no modification to openphuquoc-v3 or DNS.
import {appendFile} from "node:fs/promises";
import {pathToFileURL} from "node:url";
const PATTERN="openphuquoc.com/places*",SCRIPT="openpq-places-ui-hotfix";
export function selectOwnedHotfixRoute(routes){
  if(!Array.isArray(routes))throw Error("Cloudflare route inventory is not an array");
  const matches=routes.filter(r=>String(r.pattern||"").toLowerCase()===PATTERN);
  if(matches.length>1)throw Error("Ambiguous duplicate Places routes; no mutation");
  if(matches.some(r=>r.script!==SCRIPT))
    throw Error("Places route is assigned to another Worker; no mutation");
  const owned=matches[0]||null;
  if(owned&&!/^[a-f0-9]{32}$/i.test(String(owned.id||"")))
    throw Error("Invalid Cloudflare route ID; no mutation");
  return owned;
}
async function main(){
  const mode=process.argv[2];
  if(!["before","detach","after"].includes(mode))
    throw Error("Usage: node verify-places-route.mjs before|detach|after");
  const token=String(process.env.CLOUDFLARE_API_TOKEN||"").trim();
  if(!token)throw Error("Cloudflare route inventory unavailable: token missing");
  const headers={Authorization:"Bearer "+token,Accept:"application/json"};
  async function api(url,method="GET"){
    const res=await fetch("https://api.cloudflare.com/client/v4"+url,
      {method,headers,signal:AbortSignal.timeout(18000)});
    const body=await res.json().catch(()=>({success:false}));
    if(!res.ok||!body.success)throw Error("Cloudflare route "+method+" HTTP "+res.status+
      ": check Workers Routes Write / Zone Read permission; no other route touched");
    return body.result;
  }
  const zones=await api("/zones?name=openphuquoc.com&per_page=20");
  if(!Array.isArray(zones)||zones.length!==1)
    throw Error("Expected exactly one openphuquoc.com zone");
  const zone=encodeURIComponent(zones[0].id);
  const path="/zones/"+zone+"/workers/routes";
  const routes=await api(path);
  const owned=selectOwnedHotfixRoute(routes);
  if(mode==="before"){
    if(process.env.GITHUB_OUTPUT)
      await appendFile(process.env.GITHUB_OUTPUT,"route_present="+(owned?"true":"false")+"\n");
    console.log("Cloudflare Places route inventory verified; count",owned?1:0);
    return;
  }
  if(mode==="after"){
    if(owned)throw Error("Temporary /places route remains attached");
    console.log("Cloudflare API verifies temporary /places route is absent");
    return;
  }
  if(!owned){console.log("Exact temporary route already absent; no delete needed");return;}
  // Re-read this exact resource to verify the owner did not change after list.
  const id=encodeURIComponent(owned.id),exact=await api(path+"/"+id);
  if(exact.id!==owned.id||exact.pattern.toLowerCase()!==PATTERN||
     exact.script!==SCRIPT)throw Error("Route ownership changed before DELETE");
  const deleted=await api(path+"/"+id,"DELETE");
  if(deleted?.id!==owned.id)throw Error("Cloudflare did not confirm exact route ID deletion");
  console.log("Deleted only verified temporary Places route; canonical Worker untouched");
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
