(() => {
  "use strict";

  const SRC = {
    critical: "https://raw.githubusercontent.com/kenzuko/Jotrip-Lab/gh-pages/weather/data/critical.json",
    marineOps: "https://raw.githubusercontent.com/kenzuko/Jotrip-Lab/data-marine-ops/data/marine_ops/latest.json",
    airport: "https://jotrip-airport-live.kenzuko.workers.dev",
    airportFallback: "https://raw.githubusercontent.com/kenzuko/Jotrip-Lab/data-sunairport/data/sunairport/latest.json"
  };

  const $ = s => document.querySelector(s);
  const fmt = (n, d = 1) => Number.isFinite(Number(n)) ? Number(n).toFixed(d) : "--";

  function ageMinutes(iso) {
    const t = Date.parse(iso || "");
    return Number.isFinite(t) ? Math.max(0, (Date.now() - t) / 60000) : Infinity;
  }

  function ageText(iso) {
    const m = ageMinutes(iso);
    if (!Number.isFinite(m)) return "không rõ thời điểm";
    if (m < 2) return "vừa cập nhật";
    if (m < 60) return Math.round(m) + " phút trước";
    return (m / 60).toFixed(1) + " giờ trước";
  }

  function stateText(s) {
    return ({
      DIRECT_CONFIRMED: "Đã xác nhận",
      FIELD_REQUIRED: "Cần xác nhận",
      UNKNOWN: "Chưa rõ"
    }[s] || "Chưa rõ");
  }

  async function getJson(url) {
    const r = await fetch(url + (url.includes("?") ? "&" : "?") + "t=" + Date.now(), { cache: "no-store" });
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  }

  async function getAirport() {
    try {
      const r = await fetch(SRC.airport + "?t=" + Date.now(), { cache: "no-store" });
      if (r.ok) {
        const b = await r.json();
        return b.latest || b;
      }
    } catch (e) {}
    return getJson(SRC.airportFallback);
  }

  function setLive(name, primary, secondary, state) {
    const box = document.querySelector('[data-live="' + name + '"]');
    if (!box) return;
    const strong = box.querySelector("strong");
    const small = box.querySelector("small");
    if (strong) strong.textContent = primary;
    if (small) small.textContent = secondary;
    box.dataset.state = state || "info";
  }

  function setContext(name, primary, secondary, state) {
    const card = document.querySelector('[data-context-card="' + name + '"]');
    if (!card) return;
    const strong = card.querySelector('[data-context-primary="' + name + '"]');
    const small = card.querySelector('[data-context-secondary="' + name + '"]');
    if (strong) strong.textContent = primary;
    if (small) small.textContent = secondary;
    card.dataset.state = state || "info";
  }

  function setHappening(name, title, note, badge, good) {
    const row = document.querySelector('[data-happening="' + name + '"]');
    if (!row) return;
    const h3 = row.querySelector("h3");
    const p = row.querySelector("p");
    const em = row.querySelector("em");
    if (h3) h3.textContent = title;
    if (p) p.textContent = note;
    if (em) {
      em.textContent = badge;
      em.classList.toggle("ok", !!good);
    }
  }

  function sunsetFor(date = new Date(), lat = 10.2172, lon = 103.9593, tz = 7) {
    const local = new Date(date.getTime() + tz * 3600000);
    const localStart = new Date(Date.UTC(local.getUTCFullYear(), 0, 0));
    const n = Math.floor((Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - localStart.getTime()) / 86400000);
    const gamma = 2 * Math.PI / 365 * (n - 1);
    const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
    const decl = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma) - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);
    const phi = lat * Math.PI / 180;
    const zen = 90.833 * Math.PI / 180;
    const cosH = (Math.cos(zen) / (Math.cos(phi) * Math.cos(decl))) - Math.tan(phi) * Math.tan(decl);
    const ha = Math.acos(Math.min(1, Math.max(-1, cosH))) * 180 / Math.PI;
    const mins = 720 - 4 * lon - eq + tz * 60 + 4 * ha;
    const hh = Math.floor(mins / 60) % 24;
    const mmRaw = Math.round(mins % 60);
    const mm = mmRaw === 60 ? 0 : mmRaw;
    return String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
  }

  function renderTicker(items) {
    const track = $("#liveTicker");
    if (!track || !items.length) return;
    const one = items.map(x => "<span>" + x[0] + "</span><b>" + x[1] + "</b><i>•</i>").join("");
    track.innerHTML = one + one;
  }

  Promise.allSettled([
    getJson(SRC.critical),
    getJson(SRC.marineOps),
    getAirport()
  ]).then(([c, m, a]) => {
    const critical = c.status === "fulfilled" ? c.value : null;
    const marine = m.status === "fulfilled" ? m.value : null;
    const airport = a.status === "fulfilled" ? a.value : null;

    const vvpq = critical?.actual?.vvpq || null;
    const dd = critical?.points?.duong_dong || null;
    const anThoi = critical?.points?.an_thoi || null;
    const criticalStamp = critical?.generated_at || critical?.local_generated_at || null;
    const criticalAge = ageMinutes(criticalStamp);

    const weatherTemp = vvpq?.temperature_c ?? dd?.local?.temperature_c ?? null;
    const weatherWind = vvpq?.wind_kmh ?? dd?.local?.wind_kmh ?? null;
    const weatherObservedAt = vvpq?.observed_at || criticalStamp;
    const weatherAge = ageMinutes(weatherObservedAt);
    const weatherSource = vvpq ? "VVPQ" : dd?.local?.temperature_class === "ESTIMATED_NOW" ? "Ước tính hiện tại" : "Weather V2";
    const weatherPrimary = weatherTemp != null ? Math.round(weatherTemp) + "°" : "--";
    const weatherSecondary = weatherTemp != null
      ? (weatherWind != null ? "Gió " + Math.round(weatherWind) + " km/h · " : "") + weatherSource + " · " + ageText(weatherObservedAt)
      : "Chưa có dữ liệu weather";
    const weatherState = !critical ? "unknown" : weatherAge <= 60 ? "good" : weatherAge <= 180 ? "watch" : "unknown";

    setLive("weather", weatherPrimary, weatherSecondary, weatherState);
    setContext("weather", weatherPrimary, weatherSecondary, weatherState);

    const seaHs = anThoi?.model?.wave_hs_m ?? anThoi?.local?.wave_hs_m ?? null;
    const seaHmax = anThoi?.model?.wave_hmax_m ?? null;
    const seaTime = anThoi?.model?.marine_sampled_time || criticalStamp;
    const seaAge = ageMinutes(seaTime);
    const seaPrimary = seaHs != null ? fmt(seaHs) + " m" : "--";
    const seaSecondary = seaHs != null
      ? "Nam đảo" + (seaHmax != null ? " · Hmax " + fmt(seaHmax) + " m" : "") + " · mô hình " + ageText(seaTime)
      : "Chưa có dữ liệu biển";
    setLive("sea", seaPrimary, seaSecondary, seaAge <= 360 ? "info" : "unknown");

    const canoState = marine?.categories?.cano?.state;
    setLive(
      "cano",
      marine ? stateText(canoState) : "Chưa có dữ liệu",
      !marine ? "Nguồn vận hành chưa tải được" : canoState === "FIELD_REQUIRED" ? "Chưa có bằng chứng trực tiếp" : "Nam đảo",
      !marine ? "unknown" : canoState === "DIRECT_CONFIRMED" ? "good" : canoState === "FIELD_REQUIRED" ? "watch" : "unknown"
    );

    const sunset = sunsetFor();
    setLive("sunset", sunset, "Bờ Tây · tính theo vị trí đảo", "info");
    setContext("sunset", sunset, "Bờ Tây · tính theo vị trí đảo", "info");

    const pointList = Object.values(critical?.points || {});
    const convScores = pointList.map(p => Number(p?.nowcast?.convective_score)).filter(Number.isFinite);
    const convMax = convScores.length ? Math.max(...convScores) : null;

    const gauges = Array.isArray(critical?.actual?.rain_gauges) ? critical.actual.rain_gauges : [];
    const observedRain = gauges.some(g => g?.rain_observed === true || Number(g?.rain_intensity_mm_h) > 0);
    const estimatedRainRates = pointList.map(p => Number(p?.local?.rain_rate_mm_h)).filter(Number.isFinite);
    const estimatedRainMax = estimatedRainRates.length ? Math.max(...estimatedRainRates) : null;

    let wxTitle = "Weather engine chưa có dữ liệu";
    let wxNote = "Mở Weather để xem nguồn và độ mới dữ liệu.";
    let wxBadge = "CHƯA CÓ";
    let wxGood = false;

    if (critical) {
      wxNote = weatherSecondary;
      if (criticalAge > 90) {
        wxTitle = "Snapshot Weather V2 đang cũ";
        wxBadge = "DỮ LIỆU CŨ";
      } else if (convMax != null && convMax >= 75) {
        wxTitle = "Nowcast ghi nhận tín hiệu đối lưu mạnh";
        wxBadge = "THEO DÕI";
      } else if (observedRain) {
        wxTitle = "Có trạm quan trắc ghi nhận mưa";
        wxBadge = "ĐO THỰC";
      } else if (estimatedRainMax != null && estimatedRainMax >= 2) {
        wxTitle = "Ước tính hiện tại cho thấy mưa đáng chú ý";
        wxBadge = "ƯỚC TÍNH";
      } else {
        wxTitle = "Chưa có cảnh báo weather nổi bật";
        wxBadge = "CẬP NHẬT";
        wxGood = weatherState === "good";
      }
    }

    setHappening("weather", wxTitle, wxNote, wxBadge, wxGood);

    const ferryState = marine?.categories?.ferry?.state;
    const fastState = marine?.categories?.fast_boat?.state;
    if (!marine) {
      setHappening("marine", "Chưa tải được trạng thái vận hành biển", "Không dùng thiếu dữ liệu để kết luận đang chạy bình thường.", "CHƯA CÓ", false);
    } else {
      const marineTitle = ferryState === "DIRECT_CONFIRMED"
        ? "Phà có bằng chứng vận hành trực tiếp"
        : "Vận hành biển đang cần xác nhận thêm";
      const marineNote = "Cano: " + stateText(canoState) + " · Tàu cao tốc: " + stateText(fastState) + " · Phà: " + stateText(ferryState);
      setHappening("marine", marineTitle, marineNote, ferryState === "DIRECT_CONFIRMED" ? "XÁC NHẬN" : "KIỂM TRA", ferryState === "DIRECT_CONFIRMED");
    }

    const airportAvailable = !!airport;
    const records = airportAvailable ? (airport.records || []) : [];
    const delayed = records.filter(x => x.status_code === "DELAYED" || x.status === "TRỄ" || Number(x.estimated_delay_minutes) > 0);
    const total = airportAvailable ? (airport?.counts?.total ?? records.length) : null;

    setHappening(
      "airport",
      !airportAvailable ? "Chưa tải được dữ liệu sân bay" : delayed.length ? delayed.length + " chuyến đang cần theo dõi" : "Bảng chuyến bay chưa thấy trễ đáng kể",
      airportAvailable ? total + " chuyến trong bảng hôm nay · nguồn Airport Live" : "Không dùng trạng thái thiếu dữ liệu để kết luận bình thường",
      !airportAvailable ? "CHƯA CÓ" : delayed.length ? "THEO DÕI" : "BÌNH THƯỜNG",
      airportAvailable && delayed.length === 0
    );

    setContext(
      "airport",
      !airportAvailable ? "Chưa có dữ liệu" : delayed.length ? delayed.length + " chuyến cần xem" : "Bình thường",
      airportAvailable ? total + " chuyến trong bảng hôm nay" : "Đang thử lại nguồn sân bay",
      !airportAvailable ? "unknown" : delayed.length ? "watch" : "good"
    );

    renderTicker([
      ["THỜI TIẾT", critical ? weatherPrimary + " · " + (criticalAge > 90 ? "DỮ LIỆU CŨ" : weatherSource.toUpperCase()) : "CHƯA CÓ"],
      ["BIỂN NAM ĐẢO", seaHs != null ? fmt(seaHs) + " m" : "CHƯA CÓ"],
      ["CANO", marine ? stateText(canoState).toUpperCase() : "CHƯA CÓ"],
      ["SÂN BAY", !airportAvailable ? "CHƯA CÓ DỮ LIỆU" : delayed.length ? delayed.length + " CHUYẾN CẦN THEO DÕI" : "BÌNH THƯỜNG"],
      ["PHÀ", marine ? stateText(ferryState).toUpperCase() : "CHƯA CÓ"],
      ["HOÀNG HÔN", sunset]
    ]);

    const decisionCard = document.querySelector("[data-decision-card]");
    if (decisionCard) {
      const tag = decisionCard.querySelector("span");
      const title = decisionCard.querySelector("strong");
      const note = decisionCard.querySelector("small");
      const img = decisionCard.querySelector("img");

      if (!critical || criticalAge > 90) {
        decisionCard.href = "weather/";
        if (tag) tag.textContent = "KIỂM TRA TRƯỚC";
        if (title) title.textContent = "Weather snapshot cần cập nhật";
        if (note) note.textContent = "Mở Weather trước khi chọn hoạt động phụ thuộc thời tiết";
      } else if ((convMax != null && convMax >= 75) || observedRain || (estimatedRainMax != null && estimatedRainMax >= 2)) {
        decisionCard.href = "stories/article.html?id=mot-nam-trong-nha-thung";
        if (tag) tag.textContent = "LỊCH LINH HOẠT";
        if (title) title.textContent = "Đổi biển lấy một câu chuyện trong nhà thùng";
        if (note) note.textContent = "Ít phụ thuộc thời tiết ngoài trời";
        if (img) {
          img.src = "https://statics.vinpearl.com/phu-quoc-fish-sauce-14_1693799607.jpg";
          img.alt = "Nhà thùng nước mắm Phú Quốc";
        }
      } else {
        decisionCard.href = "#areas";
        if (tag) tag.textContent = "HỢP HÔM NAY";
        if (title) title.textContent = "Ra biển trước hoàng hôn";
        if (note) note.textContent = "Bờ Tây · kiểm tra Live Island Status trước khi đi";
      }
    }

    window.OPENPQ_HOME = {
      generated_at: new Date().toISOString(),
      live_status: {
        weather: {
          primary: weatherPrimary,
          secondary: weatherSecondary,
          source_class: vvpq ? "ACTUAL" : "ESTIMATED_NOW",
          source_updated_at: weatherObservedAt,
          freshness: weatherState
        },
        sea: {
          primary: seaPrimary,
          secondary: seaSecondary,
          source_class: "MODEL",
          source_updated_at: seaTime,
          freshness: seaAge <= 360 ? "fresh" : "stale"
        },
        marine: {
          primary: marine ? stateText(canoState) : "Chưa có dữ liệu",
          source_class: "MIXED"
        },
        airport: {
          primary: !airportAvailable ? "Chưa có dữ liệu" : delayed.length ? delayed.length + " chuyến cần xem" : "Bình thường",
          source_class: "LIVE_OPERATIONAL"
        },
        sunset: {
          primary: sunset,
          source_class: "ASTRONOMICAL"
        }
      },
      source_health: {
        weather_critical: c.status,
        marine_ops: m.status,
        airport: a.status
      }
    };
  });
})();