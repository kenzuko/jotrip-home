import {handleWeatherData} from "../../_shared/weather-edge.js";
import {readWeatherAlertHistory} from "../../_shared/weather-alert-runtime.js";

// Cloudflare Pages serves cms.openphuquoc.com from the same OpenPQ engine.
// Unknown paths are still handled by normal static assets.
export async function onRequest(context){
  if(new URL(context.request.url).pathname==="/weather/data/alert-history.json")
    return readWeatherAlertHistory(context.env);
  return handleWeatherData(context.request,()=>context.next(),p=>context.waitUntil(p));
}
