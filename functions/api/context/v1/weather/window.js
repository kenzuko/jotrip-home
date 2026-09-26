import {handleWeatherWindow} from "../../../../_shared/weather-context.js";

// Keep the CMS same-origin API available through Pages Functions as well as
// the OpenPQ Worker. The shared handler owns validation and error semantics.
export async function onRequest({request}){
  return handleWeatherWindow(request);
}
