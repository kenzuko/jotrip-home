import {publicConfig,publicSubmit} from "../_shared/place-feedback.js";
export async function onRequest({request,env}){
  if(request.method==="GET")return publicConfig(env);
  if(request.method==="POST")return publicSubmit(request,env);
  return new Response(null,{status:405,headers:{allow:"GET, POST"}});
}
