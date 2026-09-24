(() => {
  "use strict";

  const CARTO_KEY = "cb1_3q98_1_d8112ce70cc7ec9b9276b0a0";

  function add(map, options = {}) {
    if (!map || !window.L) return null;

    const maxZoom = Number(options.maxZoom) || 19;
    let switched = false;
    let failures = 0;
    let active = null;

    const primary = L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=" + encodeURIComponent(CARTO_KEY),
      {
        subdomains: "abcd",
        maxZoom,
        detectRetina: true,
        attribution: "&copy; OpenStreetMap contributors &copy; CARTO"
      }
    );

    const fallback = () => L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: Math.min(maxZoom, 19),
        detectRetina: true,
        attribution: "&copy; OpenStreetMap contributors"
      }
    );

    const switchToFallback = () => {
      if (switched) return;
      switched = true;
      try { map.removeLayer(primary); } catch {}
      active = fallback().addTo(map);
      setTimeout(() => map.invalidateSize(), 80);
    };

    primary.on("tileerror", () => {
      failures += 1;
      if (failures >= 2) switchToFallback();
    });

    primary.on("load", () => {
      failures = 0;
    });

    active = primary.addTo(map);

    return {
      get layer() { return active; },
      fallback: switchToFallback
    };
  }

  window.OpenPQMapBase = { add };
})();