/* Shared browser/Node venue normalization for Near Me. No network or UI dependencies. */
(function(root,factory){
  const api=factory();
  root.OpenPQVenue=api;
  if(typeof module==="object"&&module.exports)module.exports=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const ZONES=Object.freeze({
    duong_dong:"zone_central_west",
    central_west:"zone_central_west",
    long_beach:"zone_central_west",
    north:"zone_north",
    south:"zone_south",
    sunset_town:"place_sunset_town"
  });
  function normalizeZone(value){
    const id=String(value||"").trim().toLowerCase();
    return ZONES[id]||id||null;
  }
  function numberInRange(value,min,max){
    if(value===null||value===undefined||String(value).trim()==="")return null;
    const number=Number(value);
    return Number.isFinite(number)&&number>=min&&number<=max?number:null;
  }
  function phuQuocCoordinates(item){
    const lat=numberInRange(item?.latitude??item?.map?.lat,9.5,10.7);
    const lon=numberInRange(item?.longitude??item?.map?.lon,103.5,104.5);
    if(lat===null||lon===null)return {lat:null,lon:null};
    return {lat,lon};
  }
  function normalizeVenue(item){
    if(!item||item.status!=="ACTIVE"||!item.id||!item.name)return null;
    const coords=phuQuocCoordinates(item);
    const category=String(item.category||"").trim();
    const precision=item.map?.precision||item.geo_precision||"unverified";
    return {
      id:item.id,
      entity_type:"venue",
      name:item.name,
      aliases:Array.isArray(item.aliases)?item.aliases:[],
      address:item.address||"",
      phone:item.phone||null,
      zone_id:normalizeZone(item.zone_id||item.zone_code),
      place_id:item.place_id||null,
      tags:[...new Set([category,...(Array.isArray(item.tags)?item.tags:[])].filter(Boolean))],
      utility_type:category,
      group:category,
      route:item.route||null,
      map:coords.lat===null?null:{...coords,precision},
      lat:coords.lat,
      lon:coords.lon,
      map_precision:coords.lat===null?null:precision,
      opening_hours_note:item.opening_hours?.note||"",
      verified_at:item.verified_at||null,
      source_ref:item.source_ref||null,
      status:item.status
    };
  }
  return {normalizeZone,numberInRange,phuQuocCoordinates,normalizeVenue};
});
