(() => {
  "use strict";
  const $=s=>document.querySelector(s);
  function repairOverlay(){
    const drawer=$("#flightDrawer"),backdrop=$("#drawerBackdrop");
    if(!drawer||!backdrop)return;
    const drawerHidden=drawer.classList.contains("hidden")||drawer.getAttribute("aria-hidden")==="true";
    if(drawerHidden){
      backdrop.classList.add("hidden");
      backdrop.style.pointerEvents="none";
    }else{
      backdrop.style.pointerEvents="";
    }
    document.body.style.pointerEvents="";
    document.documentElement.style.pointerEvents="";
  }
  function closeTransientUi(){
    const drawer=$("#flightDrawer"),backdrop=$("#drawerBackdrop");
    if(drawer){drawer.classList.add("hidden");drawer.setAttribute("aria-hidden","true")}
    if(backdrop){backdrop.classList.add("hidden");backdrop.style.pointerEvents="none"}
    document.body.style.pointerEvents="";
    document.documentElement.style.pointerEvents="";
  }
  window.addEventListener("pageshow",()=>{closeTransientUi();setTimeout(repairOverlay,0)});
  window.addEventListener("pagehide",closeTransientUi);
  window.addEventListener("popstate",closeTransientUi);
  window.addEventListener("error",()=>setTimeout(repairOverlay,0));
  window.addEventListener("unhandledrejection",()=>setTimeout(repairOverlay,0));
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")setTimeout(repairOverlay,0)});
  setTimeout(repairOverlay,8000);
})();