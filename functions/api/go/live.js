import {handleGoLive} from "../../_shared/go-live.js";

// GO calls this same-origin CMS route; preserve the shared Worker contract.
export async function onRequest({request}){
  return handleGoLive(request);
}
