import {handleWeatherData} from "../_shared/weather-edge.js";

// Only spatial JSON routes listed in _routes.json reach this Pages function.
export async function onRequest(context){
  return handleWeatherData(context.request,()=>context.next(),p=>context.waitUntil(p));
}
