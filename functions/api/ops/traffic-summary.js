import {trafficReport} from "../../_shared/traffic-analytics.js";

const json=(body,status=200)=>new Response(JSON.stringify(body),{
  status,
  headers:{
    "Content-Type":"application/json; charset=utf-8",
    "Cache-Control":"private, no-store",
    "X-Robots-Tag":"noindex"
  }
});

async function digest(value){
  return new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(String(value||""))));
}
function equalBytes(a,b){
  if(a.length!==b.length)return false;
  let diff=0;
  for(let i=0;i<a.length;i++)diff|=a[i]^b[i];
  return diff===0;
}
async function validBearer(request,secret){
  const header=String(request.headers.get("authorization")||"");
  if(!header.startsWith("Bearer "))return false;
  const token=header.slice(7);
  const [left,right]=await Promise.all([digest(token),digest(secret)]);
  return equalBytes(left,right);
}

export async function onRequest({request,env}){
  if(request.method!=="GET")return json({error:"Method not allowed"},405);

  const secret=String(env.OPS_ANALYTICS_BRIDGE_SECRET||"");
  if(secret.length<32)return json({error:"Analytics bridge is not configured"},503);
  if(!await validBearer(request,secret))return json({error:"Unauthorized"},401);

  return trafficReport(request,env);
}

export const OPS_ANALYTICS_BRIDGE_TEST={validBearer};
