(()=>{
  const ENDPOINT="/api/cms/drafts";
  const queues=new Map();

  async function request(url,options={}){
    const response=await fetch(url,{credentials:"include",cache:"no-store",...options,
      headers:{...(options.body?{"Content-Type":"application/json"}:{}),...(options.headers||{})}});
    let data=null;
    try{data=await response.json();}catch{data={};}
    if(!response.ok){
      const error=new Error(data?.error||("Draft API HTTP "+response.status));
      error.status=response.status;
      error.detail=data?.detail||null;
      throw error;
    }
    return data;
  }

  function enqueue(path,fn){
    const key=String(path||"");
    const prior=queues.get(key)||Promise.resolve();
    const next=prior.catch(()=>{}).then(fn);
    const tracked=next.finally(()=>{if(queues.get(key)===tracked)queues.delete(key);});
    queues.set(key,tracked);
    return next;
  }

  function load(path){
    return request(ENDPOINT+"?path="+encodeURIComponent(path));
  }

  function save({moduleId,path,baseSha,data,checkpoint=false}){
    return enqueue(path,()=>request(ENDPOINT,{
      method:"POST",
      body:JSON.stringify({
        action:"save",module_id:moduleId,path,base_sha:baseSha,data,
        checkpoint:Boolean(checkpoint)
      })
    }));
  }

  function restore(path,revisionId){
    return enqueue(path,()=>request(ENDPOINT,{
      method:"POST",
      body:JSON.stringify({action:"restore",path,revision_id:revisionId})
    }));
  }

  function clear(path){
    return enqueue(path,()=>request(ENDPOINT,{
      method:"POST",
      body:JSON.stringify({action:"clear",path})
    }));
  }

  window.OPQServerDrafts={load,save,restore,clear};
})();
