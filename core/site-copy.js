(()=>{
  "use strict";
  const nodes=[...document.querySelectorAll("[data-cms-static-field]")];
  const value=(obj,path)=>path.split(".").reduce((v,k)=>v?.[k],obj);
  if(nodes.length){
    fetch("/data/home-copy.json",{cache:"default"})
      .then(r=>r.ok?r.json():Promise.reject())
      .then(data=>nodes.forEach(el=>{const v=value(data,el.dataset.cmsStaticField);if(typeof v==="string")el.textContent=v;}))
      .catch(()=>{});
  }
  const localQa=["localhost","127.0.0.1"].includes(location.hostname)
    &&new URLSearchParams(location.search).get("cms-inline-qa")==="1";
  if(location.hostname==="cms.openphuquoc.com"||localQa){
    const loader=document.createElement("script");loader.src="/core/cms-editor-loader.js?v=1";loader.dataset.cmsEditor="static";document.body.append(loader);
  }
})();
