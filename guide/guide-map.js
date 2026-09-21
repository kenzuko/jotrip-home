(() => {
  "use strict";

  const ZONES = {
    north:  { label:"Bắc đảo", center:[10.3759,103.9000], radius:8500 },
    center: { label:"Trung tâm & bờ Tây", center:[10.2172,103.9593], radius:6500 },
    south:  { label:"Nam đảo", center:[10.0191,104.0150], radius:7000 }
  };

  function focusCard(id) {
    document.querySelectorAll(".zone-card[data-zone-id]").forEach(card => {
      card.dataset.mapActive = card.dataset.zoneId === id ? "true" : "false";
    });
    const card = document.querySelector('.zone-card[data-zone-id="' + id + '"]');
    if (card) card.scrollIntoView({ behavior:"smooth", block:"nearest", inline:"center" });
  }

  function init() {
    const host = document.querySelector("#guideZoneMap");
    if (!host) return;
    if (!window.L) {
      host.innerHTML = '<div class="guide-map-unavailable"><strong>Chưa mở được bản đồ.</strong><span>Ba vùng bên cạnh vẫn dùng được.</span></div>';
      return;
    }

    const map = L.map(host, {
      zoomControl:true,
      attributionControl:true,
      preferCanvas:true,
      scrollWheelZoom:false
    }).setView([10.20,103.97],10);

    if (window.OpenPQMapBase?.add) {
      window.OpenPQMapBase.add(map,{maxZoom:19});
    } else {
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{
        maxZoom:19,
        attribution:"&copy; OpenStreetMap contributors"
      }).addTo(map);
    }

    Object.entries(ZONES).forEach(([id,z]) => {
      const circle = L.circle(z.center,{
        radius:z.radius,
        weight:1.5,
        color:"#28766f",
        fillColor:"#54d4cb",
        fillOpacity:.10
      }).addTo(map);

      const label = L.marker(z.center,{
        interactive:true,
        icon:L.divIcon({
          className:"guide-zone-label",
          html:"<span>"+z.label+"</span>",
          iconSize:[150,30],
          iconAnchor:[75,15]
        })
      }).addTo(map);

      const activate = () => {
        focusCard(id);
        circle.setStyle({weight:2.5,color:"#ff704f",fillColor:"#ffd35c",fillOpacity:.18});
        setTimeout(() => circle.setStyle({weight:1.5,color:"#28766f",fillColor:"#54d4cb",fillOpacity:.10}),1000);
      };
      circle.on("click",activate);
      label.on("click",activate);
    });

    setTimeout(() => map.invalidateSize(),120);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded",init,{once:true});
  } else {
    init();
  }
})();