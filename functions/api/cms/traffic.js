import {trafficReport} from "../../_shared/traffic-analytics.js";
import {verifyTrafficOwner} from "../../_shared/owner-traffic-auth.js";
export async function onRequest({request,env}){
  if(request.method!=="GET")return new Response("Method not allowed",{status:405,headers:{Allow:"GET","Cache-Control":"no-store"}});
  const auth=await verifyTrafficOwner(request,env);
  return auth.denied||trafficReport(request,env);
}
