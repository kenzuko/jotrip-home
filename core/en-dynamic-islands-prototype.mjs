// Prototype only: scoped, batched translation for dynamic UI islands.
// It is intentionally not wired into production yet.
export function observeDynamicIsland(root,{translate,Observer=globalThis.MutationObserver,raf=globalThis.requestAnimationFrame}={}){
  if(!root||typeof translate!=="function")throw new Error("root and translate are required");
  let scheduled=false;
  const dirty=new Set();
  const flush=()=>{
    scheduled=false;
    const nodes=[...dirty];
    dirty.clear();
    for(const node of nodes)translate(node);
  };
  const schedule=node=>{
    dirty.add(node);
    if(scheduled)return;
    scheduled=true;
    (raf||((fn)=>setTimeout(fn,0)))(flush);
  };
  translate(root);
  if(!Observer)return {disconnect(){},flush};
  const observer=new Observer(records=>{
    for(const record of records){
      if(record.type==="characterData")schedule(record.target.parentElement||root);
      else if(record.type==="attributes")schedule(record.target);
      else for(const node of record.addedNodes||[])schedule(node.nodeType===1?node:node.parentElement||root);
    }
  });
  observer.observe(root,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:["placeholder","aria-label","title","alt","value","data-label"]});
  return {disconnect:()=>observer.disconnect(),flush};
}
