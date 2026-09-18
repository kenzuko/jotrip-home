/* Open Phu Quoc Today Engine v1 - pure decision layer, no network access. */
(function(global){
  function num(v){v=Number(v);return Number.isFinite(v)?v:null}
  function item(type,title,summary,state,url){return {type:type,title:title,summary:summary,state:state||"INFO",url:url||null}}
  function build(input){
    input=input||{};
    const out={generated_at:new Date().toISOString(),breaking:[],recommendations:[],signals:[]};
    const wx=input.weather||{}, marine=input.marine||{}, airport=input.airport||{}, events=input.events||[];

    const rain=num(wx.rain_rate_mm_h);
    if(rain!=null && rain>=10) out.breaking.push(item("WEATHER","Mưa đang tăng nhanh","Nên kiểm tra lại hoạt động ngoài trời và thời gian di chuyển.","ALERT","weather/"));
    else if(rain!=null && rain>=2) out.breaking.push(item("WEATHER","Có mưa đáng chú ý","Ưu tiên kế hoạch linh hoạt trong vài giờ tới.","WATCH","weather/"));

    const conv=num(wx.convective_score);
    if(conv!=null && conv>=75) out.breaking.push(item("WEATHER","Đối lưu đang hoạt động mạnh","Theo dõi mưa dông cục bộ và các hoạt động ngoài trời.","WATCH","weather/"));

    const hs=num(marine.wave_hs_m);
    if(hs!=null && hs>=1.5) out.breaking.push(item("MARINE","Biển động hơn bình thường","Các hoạt động cano và đảo cần kiểm tra trạng thái vận hành trước khi đi.","ALERT","weather/"));
    else if(hs!=null && hs>=1.0) out.breaking.push(item("MARINE","Biển cần theo dõi","Điều kiện trên biển có thể kém êm hơn.","WATCH","weather/"));

    const delayed=num(airport.delayed_count);
    if(delayed!=null && delayed>=3) out.recommendations.push(item("AIRPORT","Kiểm tra chuyến bay trước khi ra sân bay",delayed+" chuyến đang có dấu hiệu trễ trong bảng hiện tại.","WATCH","airport/"));

    const now=Date.now();
    events.forEach(function(e){
      const t=e.starts_at?Date.parse(e.starts_at):NaN;
      if(Number.isFinite(t) && t>=now && t-now<=6*3600*1000){
        out.recommendations.push(item("EVENT",e.name||"Sự kiện sắp diễn ra",(e.place?e.place+" · ":"")+(e.time_label||""),"INFO",e.url||null));
      }
    });

    if(!out.breaking.length) out.signals.push(item("ISLAND","Chưa có cảnh báo nổi bật","Tiếp tục xem trạng thái trực tiếp theo từng module.","GOOD",null));
    return out;
  }
  global.OpenPQTodayEngine={build:build};
})(window);
