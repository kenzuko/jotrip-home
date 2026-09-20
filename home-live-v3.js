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
      RUNNING: "Đang hoạt động",
      SUSPENDED: "Tạm dừng",
      DIRECT_CONFIRMED: "Đã xác nhận",
      FIELD_REQUIRED: "Cần xác nhận",
      UNKNOWN: "Chưa rõ"
    }[s] || "Chưa rõ");
  }

  async function getJson(url, timeoutMs = 10000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const r = await fetch(url + (url.includes("?") ? "&" : "?") + "t=" + Date.now(), {
        cache: "no-store",
        signal: controller.signal
      });
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  async function getAirport() {
    try {
      const b = await getJson(SRC.airport);
      return b.latest || b;
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

    const tuneSpeed = () => {
      const halfWidth = Math.max(1, track.scrollWidth / 2);
      const mobile = matchMedia("(max-width:760px)").matches;
      const pxPerSecond = mobile ? 104 : 92;
      const seconds = Math.max(mobile ? 8.5 : 9.5, Math.min(17, halfWidth / pxPerSecond));
      track.style.setProperty("--ticker-duration", seconds.toFixed(2) + "s");
    };
    requestAnimationFrame(tuneSpeed);
    if (!track.dataset.speedBound) {
      track.dataset.speedBound = "1";
      addEventListener("resize", tuneSpeed, { passive: true });
    }
  }

  function vnClockParts(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Ho_Chi_Minh",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).formatToParts(date);
    const hour = Number(parts.find(p => p.type === "hour")?.value || 0);
    const minute = Number(parts.find(p => p.type === "minute")?.value || 0);
    return {
      hour,
      minute,
      minutes: hour * 60 + minute,
      label: String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0")
    };
  }

  function clockMinutes(label) {
    const m = String(label || "").match(/^(\d{1,2}):(\d{2})$/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
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
    const weatherSource = vvpq ? "Quan trắc sân bay" : dd?.local?.temperature_class === "ESTIMATED_NOW" ? "Ước tính hiện tại" : "JoTrip Weather";
    const weatherPrimary = weatherTemp != null ? Math.round(weatherTemp) + "°" : "--";
    const weatherSecondary = weatherTemp != null
      ? (weatherWind != null ? "Gió " + Math.round(weatherWind) + " km/h · " : "") + weatherSource + " · " + ageText(weatherObservedAt)
      : "Chưa có dữ liệu thời tiết";
    const weatherState = !critical ? "unknown" : weatherAge <= 60 ? "good" : weatherAge <= 180 ? "watch" : "unknown";

    setLive("weather", weatherPrimary, weatherSecondary, weatherState);
    setContext("weather", weatherPrimary, weatherSecondary, weatherState);

    const seaHs = anThoi?.model?.wave_hs_m ?? anThoi?.local?.wave_hs_m ?? null;
    const seaHmax = anThoi?.model?.wave_hmax_m ?? null;
    const seaTime = anThoi?.model?.marine_sampled_time || criticalStamp;
    const seaAge = ageMinutes(seaTime);
    const seaPrimary = seaHs != null ? fmt(seaHs) + " m" : "--";
    const seaSecondary = seaHs != null
      ? "Nam đảo" + (seaHmax != null ? " · Hmax " + fmt(seaHmax) + " m" : "") + " · dự báo " + ageText(seaTime)
      : "Chưa có dữ liệu biển";
    setLive("sea", seaPrimary, seaSecondary, seaAge <= 360 ? "info" : "unknown");

    const canoState = marine?.categories?.cano?.state;
    setLive(
      "cano",
      marine ? stateText(canoState) : "Chưa có dữ liệu",
      !marine ? "Nguồn vận hành chưa tải được" : canoState === "FIELD_REQUIRED" ? "Chưa có bằng chứng trực tiếp" : "Nam đảo",
      !marine ? "unknown" : ["RUNNING", "DIRECT_CONFIRMED"].includes(canoState) ? "good" : canoState === "SUSPENDED" ? "bad" : canoState === "FIELD_REQUIRED" ? "watch" : "unknown"
    );

    const sunset = sunsetFor();
    setLive("sunset", sunset, "Bờ Tây · tính theo vị trí đảo", "info");
    setContext("sunset", sunset, "Bờ Tây · tính theo vị trí đảo", "info");

    const pointList = Object.values(critical?.points || {});
    const convectiveLevels = pointList
      .map(p => String(p?.nowcast?.convective_level || "").toUpperCase())
      .filter(Boolean);
    const hasHighConvective = convectiveLevels.includes("HIGH");
    const hasElevatedConvective = convectiveLevels.includes("ELEVATED");

    const gauges = Array.isArray(critical?.actual?.rain_gauges) ? critical.actual.rain_gauges : [];
    const observedRain = gauges.some(g => g?.rain_observed === true || Number(g?.rain_intensity_mm_h) > 0);

    function renderNowSuggestion() {
      const card = document.querySelector("[data-now-card]");
      if (!card) return;

      const now = vnClockParts();
      const todaySunset = sunsetFor();
      const sunsetMinute = clockMinutes(todaySunset);
      const minutesToSunset = Number.isFinite(sunsetMinute) ? sunsetMinute - now.minutes : NaN;

      const kicker = card.querySelector("[data-now-kicker]");
      const time = card.querySelector("[data-now-time]");
      const title = card.querySelector("[data-now-title]");
      const note = card.querySelector("[data-now-note]");
      const primary = card.querySelector("[data-now-primary]");
      const secondary = card.querySelector("[data-now-secondary]");

      let cfg = {
        tone: "default",
        title: "Chưa biết đi đâu? Nhìn tình hình đảo trước.",
        note: "Chỉ cần biết trời đang ra sao, biển thế nào và còn bao nhiêu thời gian trong ngày là dễ chọn hơn nhiều.",
        primaryText: "Xem hôm nay →",
        primaryHref: "#happening",
        secondaryText: "Khám phá",
        secondaryHref: "explore/"
      };

      const currentCriticalAge = ageMinutes(criticalStamp);

      if (!critical || currentCriticalAge > 90) {
        cfg = {
          tone: "watch",
          title: "Khoan chốt lịch ngoài trời.",
          note: "Dữ liệu thời tiết chưa đủ mới. Mở lại mục Thời tiết & Biển trước khi rời chỗ ở.",
          primaryText: "Mở Thời tiết & Biển →",
          primaryHref: "weather/",
          secondaryText: "Tìm chỗ ít phụ thuộc thời tiết",
          secondaryHref: "explore/?intent=rainy-day"
        };
      } else if (hasHighConvective || hasElevatedConvective || observedRain) {
        cfg = {
          tone: "watch",
          title: observedRain ? "Đang có mưa - đừng khóa lịch quá chặt" : "Trời đang đổi - giữ lịch linh hoạt",
          note: "Phú Quốc có thể mưa chỗ này mà chỗ khác vẫn ráo. Xem đúng khu mình sắp đi trước khi chạy xa.",
          primaryText: "Xem Thời tiết & Biển →",
          primaryHref: "weather/",
          secondaryText: "Gợi ý ngày mưa",
          secondaryHref: "explore/?intent=rainy-day"
        };
      } else if (Number.isFinite(minutesToSunset) && minutesToSunset > 0 && minutesToSunset <= 120) {
        cfg = {
          tone: "sunset",
          title: "Còn khoảng " + minutesToSunset + " phút tới hoàng hôn",
          note: "Muốn ngắm hoàng hôn thì nên chọn điểm ngay bây giờ, nhất là nếu còn phải chạy qua bờ Tây.",
          primaryText: "Xem điểm ngắm hoàng hôn →",
          primaryHref: "explore/?intent=evening",
          secondaryText: "Tối nay có gì",
          secondaryHref: "#happening"
        };
      } else if (now.minutes < 12 * 60) {
        cfg = {
          tone: "default",
          title: "Buổi sáng, chọn một hướng rồi đi.",
          note: "Xem trời và tình hình vận hành trước. Sau đó chọn Bắc, trung tâm hoặc Nam đảo làm trục cho ngày hôm nay.",
          primaryText: "Xem trạng thái đảo →",
          primaryHref: "#today",
          secondaryText: "Chọn nơi đi",
          secondaryHref: "explore/"
        };
      } else if (Number.isFinite(minutesToSunset) && minutesToSunset > 120) {
        cfg = {
          tone: "default",
          title: "Chiều vẫn còn đủ dài để đi thêm một chỗ.",
          note: "Ưu tiên chỗ gần mình đang ở. Nếu muốn ngắm hoàng hôn, đừng để tới sát giờ mới chạy qua bờ Tây.",
          primaryText: "Chọn nơi đi →",
          primaryHref: "explore/",
          secondaryText: "Kiểm tra thời tiết",
          secondaryHref: "weather/"
        };
      } else {
        cfg = {
          tone: "default",
          title: "Tối rồi, đừng chạy thêm cho mệt.",
          note: "Chọn một khu để ăn, đi bộ hoặc xem show. Buổi tối vui hơn khi mình bớt chạy xe.",
          primaryText: "Xem tối nay có gì →",
          primaryHref: "#happening",
          secondaryText: "Tìm món ăn",
          secondaryHref: "food/"
        };
      }

      card.dataset.tone = cfg.tone;
      if (kicker) kicker.textContent = "GỢI Ý NGAY LÚC NÀY";
      if (time) {
        time.textContent = now.label;
        time.dateTime = now.label;
      }
      if (title) title.textContent = cfg.title;
      if (note) note.textContent = cfg.note;
      if (primary) {
        primary.textContent = cfg.primaryText;
        primary.href = cfg.primaryHref;
      }
      if (secondary) {
        secondary.textContent = cfg.secondaryText;
        secondary.href = cfg.secondaryHref;
      }
    }

    renderNowSuggestion();
    setInterval(renderNowSuggestion, 60000);

    let wxTitle = "Chưa có dữ liệu thời tiết";
    let wxNote = "Mở Thời tiết & Biển để xem chi tiết và thời điểm cập nhật.";
    let wxBadge = "CHƯA CÓ";
    let wxGood = false;

    if (critical) {
      wxNote = weatherSecondary;
      if (criticalAge > 90) {
        wxTitle = "Dữ liệu thời tiết cần cập nhật";
        wxBadge = "DỮ LIỆU CŨ";
      } else if (hasHighConvective) {
        wxTitle = "Nguy cơ dông đang ở mức cao";
        wxBadge = "THEO DÕI";
      } else if (hasElevatedConvective) {
        wxTitle = "Nguy cơ dông đang tăng";
        wxBadge = "LƯU Ý";
      } else if (observedRain) {
        wxTitle = "Có trạm quan trắc ghi nhận mưa";
        wxBadge = "ĐO THỰC";
      } else {
        wxTitle = "Dữ liệu thời tiết đang cập nhật";
        wxBadge = "CẬP NHẬT";
        wxGood = weatherState === "good";
      }
    }

    setHappening("weather", wxTitle, wxNote, wxBadge, wxGood);

    const ferryState = marine?.categories?.ferry?.state;
    const fastState = marine?.categories?.fast_boat?.state;
    const marineStamp = marine?.collected_at_vn || marine?.generated_at || null;
    const marineAge = ageMinutes(marineStamp);
    const operationalStates = [canoState, fastState, ferryState].filter(Boolean);
    const marineOverall = !marine || !operationalStates.length || marineAge > 1440
      ? "unknown"
      : operationalStates.some(x => x === "SUSPENDED" || x === "FIELD_REQUIRED")
        ? "watch"
        : operationalStates.every(x => x === "RUNNING" || x === "DIRECT_CONFIRMED") ? "normal" : "unknown";

    setLive(
      "ferry",
      marine ? stateText(ferryState) : "Chưa có dữ liệu",
      !marine ? "Nguồn vận hành chưa tải được" : "Phà · kiểm tra bằng chứng vận hành",
      !marine ? "unknown" : ["RUNNING", "DIRECT_CONFIRMED"].includes(ferryState) ? "good" : ["SUSPENDED", "FIELD_REQUIRED"].includes(ferryState) ? "watch" : "unknown"
    );
    if (!marine) {
      setHappening("marine", "Chưa tải được trạng thái vận hành biển", "Không dùng thiếu dữ liệu để kết luận đang chạy bình thường.", "CHƯA CÓ", false);
    } else {
      const marineTitle = ferryState === "DIRECT_CONFIRMED"
        ? "Phà có bằng chứng vận hành trực tiếp"
        : "Vận hành biển đang cần xác nhận thêm";
      const marineNote = "Cano: " + stateText(canoState) + " · Tàu cao tốc: " + stateText(fastState) + " · Phà: " + stateText(ferryState);
      setHappening("marine", marineTitle, marineNote, ferryState === "DIRECT_CONFIRMED" ? "XÁC NHẬN" : "KIỂM TRA", ferryState === "DIRECT_CONFIRMED");
    }

    const airportStamp = airport?.collected_at_vn || airport?.generated_at || null;
    const airportAge = ageMinutes(airportStamp);
    const airportQaUsable = airport?.quality?.usable !== false;
    const airportAvailable = !!airport && airportQaUsable && airportAge <= 15;
    const airportLoaded = !!airport;
    const records = airportAvailable ? (airport.records || []) : [];
    const delayed = records.filter(x => x.status_code === "DELAYED" || x.status === "TRỄ" || Number(x.estimated_delay_minutes) > 0);
    const total = airportAvailable ? (airport?.counts?.total ?? records.length) : null;

    setHappening(
      "airport",
      !airportAvailable ? (airportLoaded ? "Dữ liệu sân bay cần cập nhật lại" : "Chưa tải được dữ liệu sân bay") : delayed.length ? delayed.length + " chuyến đang cần theo dõi" : "Chưa thấy chuyến trễ đáng kể",
      airportAvailable ? total + " chuyến trong bảng hôm nay · cập nhật " + ageText(airportStamp) : "Không dùng dữ liệu thiếu hoặc cũ để kết luận bình thường",
      !airportAvailable ? "CẦN KIỂM TRA" : delayed.length ? "THEO DÕI" : "ĐANG CẬP NHẬT",
      airportAvailable && delayed.length === 0
    );

    setContext(
      "airport",
      !airportAvailable ? "Cần kiểm tra" : delayed.length ? delayed.length + " chuyến cần xem" : "Đang cập nhật",
      airportAvailable ? total + " chuyến hôm nay · " + ageText(airportStamp) : airportLoaded ? "Dữ liệu hiện có không còn đủ mới" : "Đang thử lại nguồn sân bay",
      !airportAvailable ? "unknown" : delayed.length ? "watch" : "good"
    );

    setLive(
      "airport",
      !airportAvailable ? "Cần kiểm tra" : delayed.length ? delayed.length + " cần xem" : "Đang cập nhật",
      airportAvailable ? total + " chuyến hôm nay · " + ageText(airportStamp) : airportLoaded ? "Dữ liệu hiện có không còn đủ mới" : "Đang thử lại nguồn sân bay",
      !airportAvailable ? "unknown" : delayed.length ? "watch" : "good"
    );

    setLive("tonight", "Mở lịch", "Show · chợ đêm · gợi ý theo giờ", "info");

    renderTicker([
      ["THỜI TIẾT", critical ? weatherPrimary + " · " + (criticalAge > 90 ? "DỮ LIỆU CŨ" : weatherSource.toUpperCase()) : "CHƯA CÓ"],
      ["BIỂN NAM ĐẢO", seaHs != null ? fmt(seaHs) + " m" : "CHƯA CÓ"],
      ["CANO", marine ? stateText(canoState).toUpperCase() : "CHƯA CÓ"],
      ["SÂN BAY", !airportAvailable ? "CẦN KIỂM TRA DỮ LIỆU" : delayed.length ? delayed.length + " CHUYẾN CẦN THEO DÕI" : "ĐANG CẬP NHẬT"],
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
        if (title) title.textContent = "Dữ liệu thời tiết cần cập nhật";
        if (note) note.textContent = "Mở Thời tiết & Biển trước khi chọn hoạt động phụ thuộc thời tiết";
      } else if (hasHighConvective || hasElevatedConvective || observedRain) {
        decisionCard.href = "stories/article.html?id=mot-nam-trong-nha-thung";
        if (tag) tag.textContent = "LỊCH LINH HOẠT";
        if (title) title.textContent = "Đổi biển lấy một câu chuyện trong nhà thùng";
        if (note) note.textContent = "Ít phụ thuộc thời tiết ngoài trời";
        if (img) {
          img.src = "https://statics.vinpearl.com/phu-quoc-fish-sauce-14_1693799607.jpg";
          img.alt = "Nhà thùng nước mắm Phú Quốc";
        }
      } else {
        decisionCard.href = "explore/?intent=sea";
        if (tag) tag.textContent = "HỢP HÔM NAY";
        if (title) title.textContent = "Ra biển trước hoàng hôn";
        if (note) note.textContent = "Bờ Tây · kiểm tra tình hình đảo trước khi đi";
      }
    }

    window.OPENPQ_HOME = {
      generated_at: new Date().toISOString(),
      live_status: {
        weather: {
          primary: weatherPrimary,
          secondary: weatherSecondary,
          status: !critical || criticalAge > 90 ? "unknown" : hasHighConvective ? "watch" : (hasElevatedConvective || observedRain) ? "advisory" : "normal",
          source_class: vvpq ? "ACTUAL" : "ESTIMATED_NOW",
          source_updated_at: weatherObservedAt,
          freshness: weatherAge <= 60 ? "fresh" : weatherAge <= 180 ? "aging" : "stale"
        },
        sea: {
          primary: seaPrimary,
          secondary: seaSecondary,
          status: seaHs == null || seaAge > 720 ? "unknown" : "info",
          source_class: "MODEL",
          source_updated_at: seaTime,
          freshness: seaAge <= 360 ? "fresh" : seaAge <= 720 ? "aging" : "stale"
        },
        ferry: {
          primary: marine ? stateText(ferryState) : "Chưa có dữ liệu",
          status: !marine ? "unknown" : ["RUNNING", "DIRECT_CONFIRMED"].includes(ferryState) ? "normal" : ["SUSPENDED", "FIELD_REQUIRED"].includes(ferryState) ? "watch" : "unknown",
          source_class: "DIRECT_OPERATIONAL",
          source_updated_at: marineStamp
        },
        transport: {
          primary: marineOverall === "normal" ? "Đã có xác nhận vận hành" : marineOverall === "watch" ? "Có nhóm cần kiểm tra" : "Chưa đủ dữ liệu",
          status: marineOverall,
          source_class: "DIRECT_OPERATIONAL",
          source_updated_at: marineStamp,
          freshness: !marine || !Number.isFinite(marineAge) ? "unknown" : marineAge <= 720 ? "fresh" : marineAge <= 1440 ? "aging" : "stale",
          categories: {
            cano: canoState || "UNKNOWN",
            fast_boat: fastState || "UNKNOWN",
            ferry: ferryState || "UNKNOWN"
          }
        },
        marine: {
          primary: marine ? stateText(canoState) : "Chưa có dữ liệu",
          status: !marine ? "unknown" : canoState === "RUNNING" || canoState === "DIRECT_CONFIRMED" ? "normal" : canoState === "SUSPENDED" || canoState === "FIELD_REQUIRED" ? "watch" : "unknown",
          source_class: "MIXED"
        },
        airport: {
          primary: !airportAvailable ? "Cần kiểm tra" : delayed.length ? delayed.length + " chuyến cần xem" : "Đang cập nhật",
          status: !airportAvailable ? "unknown" : delayed.length ? "watch" : "normal",
          source_class: "LIVE_OPERATIONAL",
          source_updated_at: airportStamp,
          freshness: !airportLoaded || !Number.isFinite(airportAge) ? "unknown" : airportAge <= 8 ? "fresh" : airportAge <= 15 ? "aging" : "stale"
        },
        sunset: {
          primary: sunset,
          status: "normal",
          source_class: "ASTRONOMICAL"
        }
      },
      signals: {
        weather_snapshot_age_min: Number.isFinite(criticalAge) ? Math.round(criticalAge) : null,
        convective_levels: [...new Set(convectiveLevels)],
        observed_rain: observedRain,
        airport_delayed_count: airportAvailable ? delayed.length : null,
        airport_total: total,
        cano_state: canoState || null,
        fast_boat_state: fastState || null,
        ferry_state: ferryState || null
      },
      source_health: {
        weather_critical: c.status,
        marine_ops: m.status,
        airport: a.status
      }
    };

    window.dispatchEvent(new CustomEvent("openpq:live-ready", { detail: window.OPENPQ_HOME }));
  });
})();
