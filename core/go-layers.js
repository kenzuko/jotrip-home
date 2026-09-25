/* Open Phu Quoc Go / map filters. Uses canonical entity types, never invents food pins. */
(function(root,factory){
  const api=factory();
  root.OpenPQGoLayers=api;
  if(typeof module==="object"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis,function(){
  "use strict";
  const TYPES=new Set(["place","activity","utility","hotel","venue"]);
  const FOOD=new Set(["LOCAL_FOOD","RESTAURANT","CAFE"]);
  const DESCRIPTIONS={
    explore:"Điểm đến và trải nghiệm có tọa độ trên đảo.",
    place:"Các điểm tham quan đã có tọa độ.",
    activity:"Show và trải nghiệm có điểm tham khảo.",
    utility:"Các tiện ích có vị trí trong dữ liệu Quanh đây.",
    hotel:"Các cơ sở lưu trú đã có tọa độ.",
    food:"Chỉ hiện quán có tọa độ đã xác minh. Với quán chưa có pin, mở danh bạ Quanh đây.",
    all:"Toàn bộ các nhóm có tọa độ. Có thể nhiều điểm cùng một vị trí."
  };
  function kind(row){
    if(!row)return null;
    const type=String(row.entity_type||"").toLowerCase();
    if(type==="venue")return FOOD.has(String(row.category||row.utility_type||"").toUpperCase())?"food":null;
    return TYPES.has(type)?type:null;
  }
  function filter(rows,layer){
    const current=DESCRIPTIONS[layer]?layer:"explore";
    return(rows||[]).filter(row=>{
      const type=kind(row);
      if(!type)return false;
      return current==="all"||(current==="explore"&&["place","activity"].includes(type))||current===type;
    });
  }
  function sortPoints(points,mode){
    const sorted=[...(points||[])];
    if(mode==="name")sorted.sort((a,b)=>String(a.name).localeCompare(String(b.name),"vi")||a.km-b.km);
    else sorted.sort((a,b)=>a.km-b.km||String(a.name).localeCompare(String(b.name),"vi"));
    return sorted;
  }
  function description(layer){return DESCRIPTIONS[layer]||DESCRIPTIONS.explore}
  return {filter,kind,sortPoints,description,availableLayers:Object.keys(DESCRIPTIONS)};
});