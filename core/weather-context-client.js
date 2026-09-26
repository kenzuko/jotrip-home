/* One same-origin browser client for GO and Near Me. It validates the shared envelope,
   preserves UNKNOWN/PARTIAL states, and never assigns a safety assessment. */
(function(root,factory){
  const api=factory();
  root.OpenPQWeatherContext=api;
  if(typeof module==="object"&&module.exports)module.exports=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const ENDPOINT="/api/context/v1/weather/window";
  const REQUEST_SCHEMA="openpq-weather-window-request-v1";
  const RESPONSE_SCHEMA="openpq-weather-window-context-v1";
  const SOURCE_STATES=new Set(["OK","PARTIAL","UNAVAILABLE","INVALID"]);
  const ITEM_STATES=new Set(["OK","PARTIAL","UNKNOWN","UNAVAILABLE","INVALID"]);
  const TIME_STATES=new Set(["IN_WINDOW_FRAMES","BRACKET_ONLY","NO_COVERAGE","NOT_EVALUATED"]);
  const isRecord=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);

  function validateRequestItems(items){
    if(!Array.isArray(items)||items.length<1||items.length>20)throw new TypeError("WEATHER_CONTEXT_ITEMS_INVALID");
    const ids=new Set();
    for(const item of items){
      if(!isRecord(item)||typeof item.entity_id!=="string"||!item.entity_id||ids.has(item.entity_id))
        throw new TypeError("WEATHER_CONTEXT_ENTITY_ID_INVALID");
      ids.add(item.entity_id);
    }
  }
  function validateResponse(payload,items){
    if(!isRecord(payload)||payload.schema_version!==RESPONSE_SCHEMA||
       !SOURCE_STATES.has(payload.source_status)||!Array.isArray(payload.items)||
       payload.items.length!==items.length)throw new Error("WEATHER_CONTEXT_RESPONSE_INVALID");
    for(let i=0;i<items.length;i++){
      const actual=payload.items[i],expected=items[i];
      if(!isRecord(actual)||actual.entity_id!==expected.entity_id||
         !ITEM_STATES.has(actual.status)||!isRecord(actual.temporal_coverage)||
         !TIME_STATES.has(actual.temporal_coverage.status)||
         actual.assessment!==null)throw new Error("WEATHER_CONTEXT_ITEM_INVALID");
    }
    return payload;
  }
  async function requestWindows(items,options={}){
    validateRequestItems(items);
    const fetchImpl=options.fetchImpl||(typeof fetch==="function"?fetch:null);
    if(typeof fetchImpl!=="function")throw new Error("WEATHER_CONTEXT_FETCH_UNAVAILABLE");
    const timeoutMs=Math.max(1000,Math.min(20000,Number(options.timeoutMs)||12000));
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    const external=options.signal;
    const abort=()=>controller.abort();
    if(external){
      if(external.aborted)controller.abort();
      else external.addEventListener("abort",abort,{once:true});
    }
    try{
      const response=await fetchImpl(ENDPOINT,{
        method:"POST",
        headers:{"accept":"application/json","content-type":"application/json"},
        cache:"no-store",
        signal:controller.signal,
        body:JSON.stringify({schema_version:REQUEST_SCHEMA,items})
      });
      if(!response||!response.ok)throw new Error("WEATHER_CONTEXT_HTTP_ERROR");
      let payload;
      try{payload=await response.json()}catch{throw new Error("WEATHER_CONTEXT_JSON_INVALID")}
      return validateResponse(payload,items);
    }finally{
      clearTimeout(timer);
      external?.removeEventListener?.("abort",abort);
    }
  }
  return {ENDPOINT,requestWindows,validateRequestItems,validateResponse};
});
