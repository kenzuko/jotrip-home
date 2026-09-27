import {collectTraffic} from "../../_shared/traffic-analytics.js";
export async function onRequestPost({request,env}){return collectTraffic(request,env);}
