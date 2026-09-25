/* Open Phu Quoc /go 1.1 - pure, session-only geographic calculations.
   Radius is geodesic straight-line distance, never road distance or ETA. */
(function(root,factory){
  const api=factory();
  root.OpenPQGoGeo=api;
  if(typeof module==="object"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis,function(){
  "use strict";
  const anchors=Object.freeze({
    zone_central_west:{lat:10.2172,lon:103.9593,label:"Dương Đông"},
    zone_south:{lat:10.0191,lon:104.0150,label:"An Thới"},
    zone_north:{lat:10.3759,lon:103.9000,label:"Gành Dầu"}
  });
  function valid(p){
    return p&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lon))&&
      +p.lat>=9.5&&+p.lat<=10.7&&+p.lon>=103.5&&+p.lon<=104.5;
  }
  function distanceKm(a,b){
    if(!valid(a)||!valid(b))return null;
    const rad=x=>x*Math.PI/180,earth=6371;
    const dlat=rad(+b.lat-+a.lat),dlon=rad(+b.lon-+a.lon);
    const h=Math.sin(dlat/2)**2+Math.cos(rad(+a.lat))*Math.cos(rad(+b.lat))*Math.sin(dlon/2)**2;
    return 2*earth*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
  }
  function nearestArea(point){
    if(!valid(point))return null;
    return Object.entries(anchors).map(([id,anchor])=>({id,km:distanceKm(point,anchor)}))
      .sort((a,b)=>a.km-b.km)[0]?.id||null;
  }
  function destinationPoint(entity){
    if(!entity)return null;
    const map=entity.map||{},p={lat:map.lat??entity.latitude,lon:map.lon??entity.longitude};
    const precision=map.precision||entity.map_precision||entity.geo_precision;
    // The source has not verified the actual position if precision is missing.
    if(!valid(p)||!precision||precision==="unverified"||precision==="area_only")return null;
    return {lat:+p.lat,lon:+p.lon,precision,verified_at:map.verified_at||entity.verified_at||null};
  }
  function inRadius(origin,destination,radiusKm){
    const km=distanceKm(origin,destination);
    return km!==null&&km<=Number(radiusKm);
  }
  function mapPoints(rows,position,radiusKm){
    if(!valid(position))return [];
    return (rows||[]).map(item=>{
      const point=destinationPoint(item),km=distanceKm(position,point);
      return point&&km!==null&&km<=radiusKm?{id:item.id,name:item.name,entity_type:item.entity_type||null,category:item.category||null,point,km,route:item.route||null}:null;
    }).filter(Boolean).sort((a,b)=>a.km-b.km);
  }
  return {anchors,valid,distanceKm,nearestArea,destinationPoint,inRadius,mapPoints};
});