// Delete only the already-unrouted historical Places preview Worker.
// This is not a generic worker cleanup tool. Any uncertainty fails closed.
import {pathToFileURL} from "node:url";
const SCRIPT="openpq-places-ui-hotfix",ZONE="openphuquoc.com";
export function verifyNoPlacesBindings(zones,routeGroups,domains,accountId){
  if(!Array.isArray(zones)||!Array.isArray(routeGroups)||!Array.isArray(domains))
    throw Error("Cloudflare route/domain inventory incomplete");
  const own=zones.filter(z=>z.name===ZONE);
  if(own.length!==1||own[0].account?.id!==accountId)
    throw Error("Expected exact OpenPhuQuoc zone owned by the requested account");
  for(const routes of routeGroups){
    if(!Array.isArray(routes))throw Error("A visible zone's route inventory is incomplete");
    if(routes.some(r=>r.script===SCRIPT))
      throw Error("Retired Places Worker is still bound to a route; no script deletion");
  }
  if(domains.some(d=>d.service===SCRIPT||d.script===SCRIPT||d.worker===SCRIPT))
    throw Error("Retired Places Worker still owns a custom domain; no script deletion");
  return true;
}
const headers=token=>({authorization:"Bearer "+token,accept:"application/json",
  "user-agent":"openpq-retired-places-cleanup"});
async function remote(token,path,method="GET"){
  const r=await fetch("https://api.cloudflare.com/client/v4"+path,{
    method,headers:headers(token),signal:AbortSignal.timeout(16000)});
  const j=await r.json().catch(()=>null);
  if(!r.ok||!j?.success)
    throw Error("Cloudflare cleanup "+method+" inventory/action HTTP "+r.status+
      "; verify zone and account Workers Read/Write permissions. No unrelated Worker changed.");
  return j;
}
async function inventory(token,accountId){
  const all=await remote(token,"/zones?per_page=50");
  if(!Array.isArray(all.result)||all.result_info?.total_pages>1)
    throw Error("Incomplete zone inventory; no script deletion");
  const zones=all.result.filter(z=>z.account?.id===accountId);
  const routeGroups=await Promise.all(zones.map(async z=>{
    const d=await remote(token,"/zones/"+encodeURIComponent(z.id)+"/workers/routes");
    if(!Array.isArray(d.result)||d.result_info?.total_pages>1)
      throw Error("Incomplete route inventory; no script deletion");
    return d.result;
  }));
  const domainData=await remote(token,"/accounts/"+accountId+"/workers/domains?per_page=50");
  if(!Array.isArray(domainData.result)||domainData.result_info?.total_pages>1)
    throw Error("Incomplete Worker custom-domain inventory; no script deletion");
  verifyNoPlacesBindings(zones,routeGroups,domainData.result,accountId);
  return {zones,routeGroups,domains:domainData.result};
}
function accountIdFromSecret(raw){
  // Normalize pasted whitespace/quotes, never print the secret.
  const val=String(raw||"").trim().replace(/^['"`]|['"`]$/g,"").replace(/\\s+/g,"");
  return /^[a-f0-9]{32}$/i.test(val)?val:null;
}
async function main(){
  const mode=process.argv[2];
  if(!["inspect","delete","verify"].includes(mode))
    throw Error("Usage: cleanup-retired-places-worker.mjs inspect|delete|verify");
  const token=String(process.env.CLOUDFLARE_API_TOKEN||"").trim();
  const accountId=accountIdFromSecret(process.env.CLOUDFLARE_ACCOUNT_ID);
  if(!token||!accountId)throw Error("Cloudflare account/credential missing or malformed; no deletion");
  const base="/accounts/"+accountId+"/workers/scripts";
  await inventory(token,accountId);
  const s=await remote(token,base+"?per_page=100");
  if(!Array.isArray(s.result)||s.result_info?.total_pages>1)
    throw Error("Incomplete Worker script inventory; no deletion");
  const existing=s.result.filter(x=>x.id===SCRIPT||x.name===SCRIPT);
  if(existing.length>1)throw Error("Ambiguous Worker script inventory; no deletion");
  if(mode==="inspect"){console.log("Exact retired preview Worker script count",existing.length);return;}
  if(mode==="verify"){
    if(existing.length)throw Error("Retired preview Worker still exists");
    console.log("Cloudflare independently verifies retired preview script absent");
    return;
  }
  if(existing.length===0){console.log("Retired preview script already absent");return;}
  // Re-read every available route and domain immediately before destructive call.
  await inventory(token,accountId);
  const deleted=await remote(token,base+"/"+encodeURIComponent(SCRIPT),"DELETE");
  if(!deleted.success)throw Error("Cloudflare did not confirm exact script deletion");
  console.log("Deleted exactly the unbound retired Places preview Worker script");
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
  main().catch(e=>{console.error("PLACES_PREVIEW_CLEANUP_STOPPED:",e.message);process.exitCode=1});
