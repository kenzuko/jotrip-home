(()=>{
  "use strict";
  const nodes=[...document.querySelectorAll("[data-cms-static-field]")];
  const value=(obj,path)=>path.split(".").reduce((v,k)=>v?.[k],obj);
  if(nodes.length){
    const rawLocale=document.querySelector('meta[name="openpq-locale"]')?.content||document.documentElement.lang||"vi";
    const locale=/^zh-hant/i.test(rawLocale)?"zh-Hant":/^zh-(?:hans|cn)/i.test(rawLocale)?"zh-Hans":String(rawLocale).toLowerCase().split("-")[0];
    const source=locale&&locale!=="vi"?"/data/i18n/"+encodeURIComponent(locale)+"/home-copy.json":"/data/home-copy.json";
    const get=url=>fetch(url,{cache:"default"}).then(r=>r.ok?r.json():Promise.reject());
    get(source)
      .catch(()=>source!=="/data/home-copy.json"?get("/data/home-copy.json"):Promise.reject())
      .then(data=>nodes.forEach(el=>{const v=value(data,el.dataset.cmsStaticField);if(typeof v==="string")el.textContent=v;}))
      .catch(()=>{});
  }
  const localQa=["localhost","127.0.0.1"].includes(location.hostname)
    &&new URLSearchParams(location.search).get("cms-inline-qa")==="1";
  if(location.hostname==="cms.openphuquoc.com"||localQa){
    const loader=document.createElement("script");loader.src="/core/cms-editor-loader.js?v=2";loader.dataset.cmsEditor="static";document.body.append(loader);
  }
})();
