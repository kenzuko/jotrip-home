import {handleWeatherData} from "../../_shared/weather-edge.js";

// Cloudflare Pages serves cms.openphuquoc.com from the same OpenPQ engine.
// Unknown paths are still handled by normal static assets.
export async function onRequest(context){
  return handleWeatherData(context.request,()=>context.next(),p=>context.waitUntil(p));
}
