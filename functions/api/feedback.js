import {publicConfig,publicSubmit} from "../_shared/place-feedback.js";

const PUBLIC_ORIGINS=new Set(["https://openphuquoc.com","https://www.openphuquoc.com"]);
function publicCors(request){
  const origin=request.headers.get("origin")||"";
  return new URL(request.url).hostname==="cms.openphuquoc.com"&&PUBLIC_ORIGINS.has(origin)?origin:null;
}
export async function onRequest({request,env}){
  const cors=publicCors(request);
  if(request.method==="OPTIONS"){
    if(!cors)return new Response(null,{status:403,headers:{"cache-control":"no-store"}});
    return new Response(null,{status:204,headers:{
      "access-control-allow-origin":cors,"access-control-allow-methods":"GET, POST, OPTIONS",
      "access-control-allow-headers":"Content-Type, Accept","access-control-max-age":"600","vary":"Origin"
    }});
  }
  let response;
  if(request.method==="GET")response=await publicConfig(env);
  else if(request.method==="POST")response=await publicSubmit(request,env);
  else response=new Response(null,{status:405,headers:{allow:"GET, POST, OPTIONS"}});
  if(!cors)return response;
  const headers=new Headers(response.headers);
  headers.set("access-control-allow-origin",cors);
  headers.set("vary","Origin");
  return new Response(response.body,{status:response.status,headers});
}
