(() => {
  "use strict";

  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[ch]));

  function gallery(images, options = {}) {
    const rows = Array.isArray(images) ? images.filter(x => x?.url) : [];
    if (!rows.length) return "";
    const title = options.title || "Nhìn nhanh";
    const eyebrow = options.eyebrow || "HÌNH ẢNH";
    return '<section class="visual-gallery-block">'+
      '<div class="visual-block-head"><span>'+esc(eyebrow)+'</span><h2>'+esc(title)+'</h2></div>'+
      '<div class="visual-gallery '+(rows.length === 1 ? "single" : "")+'">'+
        rows.map(img =>
          '<figure class="visual-photo">'+
            '<img src="'+esc(img.url)+'" alt="'+esc(img.alt || img.caption || "Ảnh Phú Quốc")+'" loading="lazy" decoding="async" onerror="this.closest(\'figure\').classList.add(\'is-error\')">'+
            '<figcaption><span>'+esc(img.caption || "")+'</span>'+
              (img.source_url ? '<a href="'+esc(img.source_url)+'" target="_blank" rel="noopener">Nguồn ảnh ↗</a>' : '')+
            '</figcaption>'+
          '</figure>'
        ).join("")+
      '</div>'+
    '</section>';
  }

  function quickFacts(facts, options = {}) {
    const rows = Array.isArray(facts) ? facts.filter(x => Array.isArray(x) && x.length >= 2) : [];
    if (!rows.length) return "";
    return '<section class="visual-facts" aria-label="'+esc(options.label || "Đọc nhanh")+'">'+
      rows.map(([k,v]) =>
        '<div><span>'+esc(k)+'</span><strong>'+esc(v)+'</strong></div>'
      ).join("")+
    '</section>';
  }

  function locator(zone, options = {}) {
    const map = options.map || zone?.map;
    const lat = Number(map?.lat);
    const lon = Number(map?.lon);
    const hasMap = Number.isFinite(lat) && Number.isFinite(lon) && map?.source;
    const precision = String(map?.precision || "");
    const exact = ["exact","point","verified_point"].includes(precision);
    const title = options.title || "Ở đâu trên đảo?";
    const label = options.label || zone?.name || "Phú Quốc";
    const anchor = map?.anchor_name || label;
    const note = options.note || (exact
      ? "Tọa độ đã có nguồn xác minh cho điểm này."
      : hasMap
        ? "Bản đồ mở tại điểm neo "+anchor+" để định hướng khu vực, không phải pin chính xác của địa điểm này."
        : "Hiện mới xác định được khu vực. Open Phu Quoc chưa đặt pin khi tọa độ chưa đủ chắc.");

    return '<section class="visual-locator">'+
      '<div class="visual-locator-copy">'+
        '<span>VỊ TRÍ</span>'+
        '<h2>'+esc(title)+'</h2>'+
        '<strong>'+esc(label)+'</strong>'+
        '<p>'+esc(note)+'</p>'+
        (hasMap
          ? '<div class="visual-map-actions">'+
              '<button type="button" data-lazy-map data-lat="'+lat+'" data-lon="'+lon+'" data-precision="'+esc(precision)+'" data-anchor="'+esc(anchor)+'">Xem bản đồ khu vực</button>'+
              '<a href="https://www.openstreetmap.org/?mlat='+lat+'&mlon='+lon+'#map=12/'+lat+'/'+lon+'" target="_blank" rel="noopener">Mở bản đồ lớn ↗</a>'+
            '</div>'
          : '')+
      '</div>'+
      '<div class="visual-locator-map" data-map-frame>'+
        '<div class="visual-map-placeholder"><span>⌖</span><strong>'+esc(label)+'</strong><small>'+(hasMap ? 'Bản đồ chỉ tải khi bạn mở' : 'Chưa đặt pin khi tọa độ chưa đủ chắc')+'</small></div>'+
      '</div>'+
    '</section>';
  }

  function bindLazyMaps(root = document) {
    root.querySelectorAll("[data-lazy-map]").forEach(button => {
      if (button.dataset.bound === "1") return;
      button.dataset.bound = "1";
      button.addEventListener("click", () => {
        const card = button.closest(".visual-locator");
        const frame = card?.querySelector("[data-map-frame]");
        if (!frame || frame.dataset.loaded === "1") return;

        const lat = Number(button.dataset.lat);
        const lon = Number(button.dataset.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

        const precision = button.dataset.precision || "";
        const delta = ["exact","point","verified_point"].includes(precision) ? 0.012 : 0.055;
        const bbox = [
          lon - delta, lat - delta,
          lon + delta, lat + delta
        ].join(",");

        const src = "https://www.openstreetmap.org/export/embed.html?bbox="+
          encodeURIComponent(bbox)+
          "&layer=mapnik&marker="+encodeURIComponent(lat+","+lon);

        frame.innerHTML = '<iframe title="Bản đồ '+esc(button.dataset.anchor || "Phú Quốc")+'" src="'+src+'" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>';
        frame.dataset.loaded = "1";
        button.textContent = "Bản đồ đã mở";
        button.disabled = true;
      });
    });
  }

  function placeholder(title, label = "Minh họa nội dung") {
    const initial = String(title || "PQ").trim().slice(0,1).toUpperCase();
    return '<div class="visual-placeholder" aria-label="'+esc(label)+'">'+
      '<span>'+esc(initial)+'</span><small>'+esc(label)+'</small>'+
    '</div>';
  }

  window.OpenPQVisual = { esc, gallery, quickFacts, locator, bindLazyMaps, placeholder };
})();