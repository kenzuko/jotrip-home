/* Shared public JSON loader. Static editorial/catalog data is deduplicated for
   the lifetime of a page and may use the browser cache. Live operational data
   keeps its own freshness rules in the specialist modules. */
(function(root){
  "use strict";
  const pending=new Map();
  function json(url){
    const key=new URL(url,location.href).href;
    if(pending.has(key))return pending.get(key);
    const task=fetch(url,{cache:"default"}).then(response=>{
      if(!response.ok)throw new Error("HTTP "+response.status+" for "+url);
      return response.json();
    }).catch(error=>{pending.delete(key);throw error});
    pending.set(key,task);
    return task;
  }
  root.OpenPQPublicData={json,get size(){return pending.size;}};
})(window);
