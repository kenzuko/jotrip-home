const SRC={
 ground:"https://raw.githubusercontent.com/kenzuko/Jotrip-Lab/data-weather/data/weather-groundtruth/latest.json",
 local:"https://raw.githubusercontent.com/kenzuko/Jotrip-Lab/data-weather/data/weather-groundtruth/local-now.json",
 nowcast:"https://raw.githubusercontent.com/kenzuko/Jotrip-Lab/data-weather/data/weather-nowcast/latest.json",
 aqi:"https://raw.githubusercontent.com/kenzuko/Jotrip-Lab/data-weather/data/weather-aqi/latest.json"
};
const $=s=>document.querySelector(s);
const fmt=n=>Number.isFinite(+n)?(+n).toFixed(1):"--";
async function get(url){const r=await fetch(url+"?t="+Date.now(),{cache:"no-store"});if(!r.ok)throw new Error(r.status);return r.json()}
Promise.allSettled([get(SRC.ground),get(SRC.local),get(SRC.nowcast),get(SRC.aqi)]).then(function(res){
 const g=res[0],l=res[1],n=res[2],a=res[3];
 if(g.status==="fulfilled"){const d=g.value, v=d.atmosphere&&d.atmosphere.vvpq; $("#wxTemp").textContent=v&&v.temperature_c!=null?Math.round(v.temperature_c)+"°C":"--"; $("#wxWind").textContent=v&&v.wind_speed_kmh!=null?Math.round(v.wind_speed_kmh)+" km/h":"--"; $("#wxTempNote").textContent=v?"VVPQ · "+(v.flight_category||""):"VVPQ"; $("#wxWindNote").textContent=v&&v.observed_at?"Quan trắc "+new Date(v.observed_at).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"}):"VVPQ";
  const rs=Object.values((d.rainfall&&d.rainfall.stations)||{}); const wet=rs.filter(x=>(x.accumulation_mm||0)>0).sort((x,y)=>y.accumulation_mm-x.accumulation_mm); const top=wet[0]||rs[0]; $("#wxRain").textContent=top?fmt(top.accumulation_mm)+" mm":"--"; $("#wxRainNote").textContent=top?top.station_name+" · "+(top.accumulation_label||""):"VRain"; $("#wxFresh").textContent=d.status==="READY"?"Dữ liệu quan trắc sẵn sàng":"Dữ liệu cần kiểm tra"; $("#wxFresh").classList.add(d.status==="READY"?"good":"watch");
 }
 if(l.status==="fulfilled"){const p=l.value.points||{}; function set(prefix,key){const x=p[key]; $(prefix+"Wave").textContent=x&&x.wave_hs_m!=null?fmt(x.wave_hs_m)+" m":"--"; $(prefix+"Sea").textContent=x?"Gió "+fmt(x.wind_kmh)+" km/h · Hmax "+fmt(x.wave_hmax_m)+" m":"Không có dữ liệu"} set("#dd","duong_dong"); set("#at","an_thoi"); set("#gd","ganh_dau");}
 if(n.status==="fulfilled"){const p=n.value.points||{}; const vals=["duong_dong","an_thoi","ganh_dau"].map(k=>p[k]&&p[k].convective_signal&&p[k].convective_signal.score).filter(Number.isFinite); const max=vals.length?Math.max.apply(null,vals):null; $("#wxConv").textContent=max==null?"--":max>=75?"Mạnh":max>=40?"Theo dõi":"Thấp"; $("#wxConvNote").textContent=max==null?"Himawari":"Điểm tín hiệu "+max+"/100";}
 if(a.status==="fulfilled"){const x=a.value.points&&a.value.points.duong_dong; $("#aqi").textContent=x&&x.aqi_us!=null?"AQI "+x.aqi_us:"--"; $("#aqiNote").textContent=x?(x.category+" · "+x.aqi_source):"Dương Đông";}
}).catch(function(){ $("#wxFresh").textContent="Không tải được dữ liệu"; $("#wxFresh").classList.add("bad"); });