(function(root){
  "use strict";
  function todayVN(now=new Date()){
    return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);
  }
  function mergeHistory(base,remote,today=todayVN()){
    const entries=new Map();
    function include(e){
      if(!e||typeof e.date!=="string"||!(/^\d{4}-\d{2}-\d{2}$/.test(e.date))||e.date>today)return;
      if(e.state!=="RUNNING"&&e.state!=="SUSPENDED")return;
      entries.set(e.date,e);
    }
    if(Array.isArray(base?.events))base.events.forEach(include);
    if(remote?.schema_version==="1.0"&&remote?.category==="cano"&&Array.isArray(remote.events)){
      remote.events.forEach(include); // Canonical data overrides stale local copies.
    }
    return {schema_version:"1.0",category:"cano",events:[...entries.values()].sort((a,b)=>a.date.localeCompare(b.date))};
  }
  function displayDate(date){
    const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date||""));
    return m?m[3]+"/"+m[2]+"/"+m[1]:"-";
  }
  root.OpenPQCanoHistory={todayVN,mergeHistory,displayDate};
})(typeof globalThis!=="undefined"?globalThis:this);
