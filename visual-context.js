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
            '<img src="'+esc(img.url)+'" alt="'+esc(img.alt || img.caption || "Ảnh Phú Quốc")+'" loading="lazy" decoding="async" data-fallback="'+esc(img.fallback_url||"")+'" data-fallback-label="'+esc(img.fallback_source_label||"")+'" data-fallback-source="'+esc(img.fallback_source_url||"")+'" onerror="if(this.dataset.fallback){this.src=this.dataset.fallback;delete this.dataset.fallback;var c=this.closest(\'figure\').querySelector(\'.visual-source-credit\');if(c){c.textContent=\'Ảnh: \'+(this.dataset.fallbackLabel||\'Ảnh thay thế\')}}else{this.closest(\'figure\').classList.add(\'is-error\')}">'+
            '<figcaption><span>'+esc(img.caption || "")+'</span>'+
              (img.source_label ? '<small class="visual-source-credit">Ảnh: '+esc(String(img.source_label).replace(/^Ảnh:\s*/i,""))+(img.license?' · '+esc(img.license):'')+'</small>' : '')+
              (/^https:\/\/creativecommons\.org\/licenses\//.test(img.license_url||"")?' · <a class="visual-photo-license" href="'+esc(img.license_url)+'" rel="noopener noreferrer license" target="_blank">Điều kiện sử dụng ảnh</a>':"")+
            '</figcaption>'+
          '</figure>'
        ).join("")+
      '</div>'+
    '</section>';
  }

  function pickHero(images) {
    const allRows = Array.isArray(images) ? images.filter(x => x?.url) : [];
    const rows = allRows.filter(x => x.hero_eligible !== false);
    if (!rows.length) return null;
    const priority = {primary:4,preferred:3,default:2,archive:1};
    return [...rows].sort((a,b)=>{
      const pa=priority[a.hero_priority]||2;
      const pb=priority[b.hero_priority]||2;
      if(pb!==pa)return pb-pa;
      const da=Date.parse(String(a.captured_at||"").length===4?a.captured_at+"-01-01":a.captured_at||"1970-01-01")||0;
      const db=Date.parse(String(b.captured_at||"").length===4?b.captured_at+"-01-01":b.captured_at||"1970-01-01")||0;
      return db-da;
    })[0]||rows[0];
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

  function infographic(items, options = {}) {
    const rows = Array.isArray(items) ? items.filter(x => x && (x.label || x.value || x.note)) : [];
    if (!rows.length) return "";
    const eyebrow = options.eyebrow || "NHÌN NHANH";
    const title = options.title || "Nắm ý chính trong vài giây";
    return '<section class="visual-infographic" aria-label="'+esc(options.label || title)+'">'+
      '<div class="visual-block-head"><span>'+esc(eyebrow)+'</span><h2>'+esc(title)+'</h2></div>'+
      '<div class="visual-infographic-grid">'+
        rows.map((x,i) =>
          '<article>'+
            '<div class="visual-infographic-icon" aria-hidden="true">'+esc(x.icon || String(i+1).padStart(2,"0"))+'</div>'+
            '<div><span>'+esc(x.label || "")+'</span><strong>'+esc(x.value || "")+'</strong>'+
              (x.note?'<p>'+esc(x.note)+'</p>':'')+
            '</div>'+
          '</article>'
        ).join("")+
      '</div>'+
    '</section>';
  }

  // Article maps render as real, browser-lazy iframes. No map request is made
  // until the section approaches the viewport; there is no second click.
  function locator(zone, options = {}) {
    const map = options.map || zone?.map;
    const lat = Number(map?.lat);
    const lon = Number(map?.lon);
    const hasMap = map?.lat != null && map?.lon != null &&
      Number.isFinite(lat) && Number.isFinite(lon) &&
      lat >= 9.4 && lat <= 10.6 && lon >= 103.4 && lon <= 104.6 &&
      typeof map?.source === "string" && map.source.trim() &&
      typeof map?.verified_at === "string" && map.verified_at.trim();
    if (!hasMap && !options.showMissing) return "";

    const precision = String(map?.precision || "");
    const exact = ["exact","point","verified_point","exact_entrance"].includes(precision);
    const title = options.title || "Ở đâu trên đảo?";
    const label = options.label || zone?.name || "Phú Quốc";
    const anchor = map?.anchor_name || zone?.map?.anchor_name || label;
    const eyebrow = options.eyebrow || "VỊ TRÍ";
    const openLabel = options.openLabel || "Mở bản đồ lớn ↗";
    const note = options.note || (exact
      ? "Xem vị trí đã được kiểm tra của địa điểm này."
      : hasMap
        ? "Bản đồ hiển thị khu vực gần " + anchor + ", không phải vị trí chính xác của địa điểm."
        : "Chưa có tọa độ đủ tin cậy để hiển thị bản đồ.");

    // A lower zoom deliberately presents area anchors as a region, not an
    // entrance pin. This is still an approximation, so keep the visible note.
    const zoom = exact ? 16 : (precision === "site_centroid" ? 15 : 12);
    const mapUrl = hasMap ? "https://www.google.com/maps?q=" +
      encodeURIComponent(lat + "," + lon) + "&z=" + zoom + "&output=embed" : "";
    const largeUrl = hasMap ? "https://www.google.com/maps/search/?api=1&query=" +
      encodeURIComponent(lat + "," + lon) : "";

    return '<section class="visual-locator">' +
      '<div class="visual-locator-copy">' +
        '<span>' + esc(eyebrow) + '</span>' +
        '<h2>' + esc(title) + '</h2>' +
        '<strong>' + esc(label) + '</strong>' +
        '<p>' + esc(note) + '</p>' +
        (hasMap ? '<div class="visual-map-actions">' +
          '<a href="' + esc(largeUrl) + '" target="_blank" rel="noopener noreferrer">' +
          esc(openLabel) + '</a></div>' : '') +
      '</div>' +
      (hasMap
        ? '<div class="visual-locator-map" data-map-frame>' +
            '<iframe title="Bản đồ ' + esc(label) + '" src="' + esc(mapUrl) +
              '" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" ' +
              'allowfullscreen></iframe>' +
            '<div class="visual-map-orientation"><span>' + (exact ? 'ĐIỂM' : 'KHU VỰC') +
              '</span><strong>' + esc(label) + '</strong><small>' +
              (exact ? 'Vị trí đã xác minh' : 'Bản đồ định hướng, không phải pin chính xác') +
              '</small></div>' +
          '</div>'
        : '<div class="visual-locator-map visual-locator-map--missing">' +
            '<p>Chưa có bản đồ cho địa điểm này.</p></div>') +
    '</section>';
  }

  // Retained for existing article callers; iframes are already in the markup.
  function bindLazyMaps() {}

  function placeholder(title, label = "Minh họa nội dung") {
    const initial = String(title || "PQ").trim().slice(0,1).toUpperCase();
    return '<div class="visual-placeholder" aria-label="'+esc(label)+'">'+
      '<span>'+esc(initial)+'</span><small>'+esc(label)+'</small>'+
    '</div>';
  }

  window.OpenPQVisual = { esc, gallery, quickFacts, infographic, locator, bindLazyMaps, placeholder, pickHero };
})();