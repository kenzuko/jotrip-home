import {publicConfig,publicSubmit} from "../_shared/place-feedback.js";

// The active public site and CMS use the same hostname. No cross-origin CORS.
export async function onRequest({request,env}){
  if(request.method==="GET")return publicConfig(env);
  if(request.method==="POST")return publicSubmit(request,env);
  return new Response(null,{status:405,headers:{"allow":"GET, POST","cache-control":"no-store"}});
}
