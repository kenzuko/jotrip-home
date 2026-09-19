/* Open Phu Quoc Today Engine v2 - pure composition layer. */
(function(global){
  function item(id,type,title,summary,status,route,meta){
    return {id:id,type:type,title:title,summary:summary,status:status||"info",route:route||null,meta:meta||{}};
  }

  function localHour(now){
    try{
      const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Ho_Chi_Minh",hour:"2-digit",hour12:false}).formatToParts(now||new Date());
      const part=parts.find(function(p){return p.type==="hour"});
      const h=Number(part&&part.value);
      return Number.isFinite(h)?h:new Date(now||Date.now()).getHours();
    }catch(e){
      return new Date(now||Date.now()).getHours();
    }
  }

  function build(input){
    input=input||{};
    const live=input.live||{};
    const signals=input.signals||{};
    const rules=Array.isArray(input.rules)?input.rules:[];
    const hour=localHour(input.now);
    const out=[];

    const wx=live.weather||{};
    if(wx.freshness==="stale" || wx.status==="unknown"){
      out.push(item("weather-stale","WEATHER","Weather cần kiểm tra lại","Dữ liệu hiện tại không đủ mới để dùng như trạng thái trực tiếp.","unknown","/weather/",{freshness:wx.freshness||"unknown"}));
    }else if(wx.status==="watch"){
      out.push(item("weather-watch","WEATHER","Thời tiết cần theo dõi","Weather V2 đang phát classification cần chú ý trước khi chọn hoạt động ngoài trời.","watch","/weather/",{convective_levels:signals.convective_levels||[]}));
    }else if(wx.status==="advisory"){
      out.push(item("weather-rain","WEATHER","Có mưa được ghi nhận","Giữ lịch linh hoạt và xem chi tiết khu vực trước khi di chuyển.","advisory","/weather/",{}));
    }else{
      out.push(item("weather-normal","WEATHER","Weather V2 chưa gắn cảnh báo nổi bật ở snapshot này",wx.secondary||"Xem Weather nếu hoạt động phụ thuộc biển hoặc mưa.","normal","/weather/",{}));
    }

    const ferry=live.ferry||{};
    const marine=live.marine||{};
    if(ferry.status==="unknown" && marine.status==="unknown"){
      out.push(item("marine-unknown","TRANSPORT","Vận hành biển chưa đủ dữ liệu","Cano, tàu cao tốc và phà cần được kiểm tra trực tiếp trước khi đi.","unknown","/ferry/",{}));
    }else if(ferry.status==="watch" || marine.status==="watch"){
      out.push(item("marine-watch","TRANSPORT","Vận hành biển cần xác nhận","Cano: "+(signals.cano_state||"chưa rõ")+" · Phà: "+(signals.ferry_state||"chưa rõ"),"watch","/ferry/",{}));
    }else{
      out.push(item("marine-status","TRANSPORT","Xem trạng thái tàu, phà và cano","Các loại phương tiện biển được tách riêng theo bằng chứng vận hành.","normal","/ferry/",{}));
    }

    const airport=live.airport||{};
    if(airport.status==="unknown"){
      out.push(item("airport-unknown","AIRPORT","Sân bay chưa có dữ liệu cập nhật","Không dùng trạng thái thiếu dữ liệu để kết luận chuyến bay đang bình thường.","unknown","/airport/",{}));
    }else if(airport.status==="watch"){
      out.push(item("airport-watch","AIRPORT",airport.primary||"Có chuyến bay cần theo dõi",(signals.airport_total==null?"-":signals.airport_total)+" chuyến trong bảng hiện tại.","watch","/airport/",{}));
    }else{
      out.push(item("airport-normal","AIRPORT","Sân bay chưa thấy gián đoạn nổi bật",(signals.airport_total==null?"-":signals.airport_total)+" chuyến trong bảng hiện tại.","normal","/airport/",{}));
    }

    const activeRule=rules.find(function(r){
      return hour>=Number(r.start_hour)&&hour<Number(r.end_hour);
    });
    if(activeRule){
      const unsafeWeather=activeRule.weather_sensitive && (wx.status==="watch" || wx.status==="unknown");
      if(!unsafeWeather){
        out.push(item("editorial-"+activeRule.id,"EDITORIAL",activeRule.title,activeRule.summary,"info",activeRule.route,{
          source_type:activeRule.source_type,
          source_id:activeRule.source_id
        }));
      }
    }

    if(live.sunset&&live.sunset.primary){
      out.push(item("sunset","ASTRONOMICAL","Hoàng hôn bờ Tây khoảng "+live.sunset.primary,"Giờ thiên văn để định hướng cuối chiều, không phải cam kết trời quang.","info","/#happening",{}));
    }

    return {generated_at:new Date().toISOString(),hour:hour,items:out.slice(0,5)};
  }

  global.OpenPQTodayEngineV2={build:build};
})(window);
