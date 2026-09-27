import {collectTraffic} from "../../_shared/traffic-analytics.js";
export async function onRequest({request,env}){return collectTraffic(request,env)}
