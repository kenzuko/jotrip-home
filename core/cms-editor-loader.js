/* Loaded only on cms.openphuquoc.com or an explicit local QA session. */
(function(){
  "use strict";
  const localQa=["localhost","127.0.0.1"].includes(location.hostname)
    &&new URLSearchParams(location.search).get("cms-inline-qa")==="1";
  if(location.hostname!=="cms.openphuquoc.com"&&!localQa)return;
  const type=document.currentScript?.dataset.cmsEditor;
  const config={
    static:{css:"/core/cms-inline-static.css?v=1",scripts:["/core/cms-draft-client.js?v=2","/core/cms-inline-static.js?v=2"]},
    story:{css:"/core/cms-inline-edit.css?v=1",scripts:["/core/cms-draft-client.js?v=2","/core/cms-direct-save-rollback.js?v=1","/core/cms-inline-edit.js?v=2"]},
    food:{css:"/core/cms-inline-food.css?v=1",scripts:["/core/cms-draft-client.js?v=2","/core/cms-direct-save-rollback.js?v=1","/core/cms-inline-food.js?v=2"]},
    page:{css:"/core/cms-inline-pages.css?v=1",scripts:["/core/cms-draft-client.js?v=2","/core/cms-direct-save-rollback.js?v=1","/core/cms-inline-pages.js?v=2"]}
  }[type];
  if(!config)return;
  if(config.css&&!document.querySelector('link[href="'+config.css+'"]')){
    const link=document.createElement("link");link.rel="stylesheet";link.href=config.css;document.head.append(link);
  }
  const load=index=>{
    if(index>=config.scripts.length)return;
    const script=document.createElement("script");script.src=config.scripts[index];
    script.onload=()=>load(index+1);document.body.append(script);
  };
  load(0);
})();
