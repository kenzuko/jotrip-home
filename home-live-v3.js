(() => {
  "use strict";

  const SRC = {
    critical: "https://raw.githubusercontent.com/kenzuko/Jotrip-Lab/gh-pages/weather/data/critical.json",
    marineOps: "https://raw.githubusercontent.com/kenzuko/Jotrip-Lab/data-marine-ops/data/marine_ops/latest.json",
    airport: "https://jotrip-airport-live.kenzuko.workers.dev",
    airportFallback: "https://raw.githubusercontent.com/kenzuko/Jotrip-Lab/data-sunairport/data/sunairport/latest.json",
    airportHistoryBase: "https://raw.githubusercontent.com/kenzuko/Jotrip-Lab/data-sunairport/data/sunairport/history"
  };

  const $ = s => document.querySelector(s);
  const fmt = (n, d = 1) => Number.isFinite(Number(n)) ? Number(n).toFixed(d) : "--";

  function ageMinutes(iso) {
    const t = Date.parse(iso || "");
    return Number.isFinite(t) ? Math.max(0, (Date.now() - t) / 60000) : Infinity;
  }

function ageText(iso) {
    const m = ageMinutes(iso);
    if (!Number.isFinite(m)) return "chưa biết lúc nào cập nhật";
    if (m < 2) return "vừa cập nhật";
    if (m < 60) return Math.round(m) + " phút trước";
    const h = Math.floor(m / 60);
    if (h < 24) return h === 1 ? "hơn 1 giờ trước" : "hơn " + h + " giờ trước";
    return Math.floor(h / 24) === 1 ? "hôm qua" : Math.floor(h / 24) + " ngày trước";
  }

function stateText(s) {
    return ({
      RUNNING: "Hôm nay chạy bình thường",
      SUSPENDED: "Tạm dừng",
      DIRECT_CONFIRMED: "Hôm nay chạy bình thường",
      FIELD_REQUIRED: "Chưa có cập nhật hôm nay",
      UNKNOWN: "Chưa có thông tin mới"
    }[s] || "Chưa có thông tin mới");
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

  async function getText(url, timeoutMs = 10000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const r = await fetch(url + (url.includes("?") ? "&" : "?") + "t=" + Date.now(), {
        cache: "no-store",
        signal: controller.signal
      });
      if (r.status === 404) return "";
      if (!r.ok) throw new Error(String(r.status));
      return r.text();
    } finally {
      clearTimeout(timeout);
    }
  }

  function vnDateKey(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone:"Asia/Ho_Chi_Minh", year:"numeric", month:"2-digit", day:"2-digit"
    }).formatToParts(date);
    const get = type => parts.find(p => p.type === type)?.value || "";
    return get("year") + "-" + get("month") + "-" + get("day");
  }

  async function getAirport() {
    try {
      const b = await getJson(SRC.airport);
      return b.latest || b;
    } catch (e) {}
    return getJson(SRC.airportFallback);
  }

function setLive(name, primary, secondary, state, freshness) {
    const box = document.querySelector('[data-live="' + name + '"]');
    if (!box) return;
    const strong = box.querySelector("strong");
    const small = box.querySelector("small");
    const time = box.querySelector("[data-live-freshness]");
    const action = box.querySelector("b");
    if (strong) strong.textContent = primary;
    if (small) small.textContent = secondary;
    if (time) time.textContent = freshness || "Chưa có tin mới";
    const actions = {
      weather:"Xem thời tiết →",
      sea:"Xem tình hình biển →",
      airport:"Xem chuyến bay →",
      cano:"Xem cano →",
      ferry:"Xem lịch tàu →",
      bus:"Xem tuyến xe →"
    };
    if (action && actions[name]) action.textContent = actions[name];
    box.dataset.state = state || "info";
  }

function freshnessText(iso, prefix = "Cập nhật") {
    const age = ageMinutes(iso);
    const t = Date.parse(iso || "");
    if (!Number.isFinite(age) || !Number.isFinite(t)) return "Chưa có tin mới";
    if (age < 180) {
      const hhmm = new Intl.DateTimeFormat("vi-VN", {
        timeZone:"Asia/Ho_Chi_Minh",hour:"2-digit",minute:"2-digit",hour12:false
      }).format(new Date(t));
      return prefix + " lúc " + hhmm;
    }
    return prefix + " " + ageText(iso);
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

  function renderTicker(items, level = "normal") {
    const track = $("#liveTicker");
    const shell = document.querySelector(".energy-ticker");
    if (!track || !shell || !Array.isArray(items) || !items.length) return;
    const safe = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[ch]));
    shell.hidden = false;
    shell.dataset.level = level;
    shell.classList.remove("is-static");

    const one = items.map(x =>
      "<span>" + safe(x[0]) + "</span><b>" +
      (x[2] ? '<a href="' + safe(x[2]) + '">' + safe(x[1]) + "</a>" : safe(x[1])) +
      "</b><i>•</i>"
    ).join("");
    track.innerHTML = one + one;

    const tuneSpeed = () => {
      const halfWidth = Math.max(1, track.scrollWidth / 2);
      const mobile = matchMedia("(max-width:760px)").matches;
      const pxPerSecond = mobile ? 104 : 92;
      const seconds = Math.max(mobile ? 8.5 : 9.5, Math.min(17, halfWidth / pxPerSecond));
      track.style.setProperty("--ticker-duration", seconds.toFixed(2) + "s");

      if (typeof track.animate === "function") {
        try { track._openpqTickerAnimation?.cancel(); } catch {}
        track.style.setProperty("animation","none","important");
        track._openpqTickerAnimation = track.animate(
          [
            { transform:"translate3d(0,0,0)" },
            { transform:"translate3d(-50%,0,0)" }
          ],
          {
            duration:seconds * 1000,
            easing:"linear",
            iterations:Infinity
          }
        );
      }
    };
    requestAnimationFrame(tuneSpeed);
    if (!track.dataset.speedBound) {
      track.dataset.speedBound = "1";
      addEventListener("resize", tuneSpeed, { passive:true });
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

  function sunsetWeatherAssessment(criticalData, sunsetLabel) {
    if (!criticalData || !Number.isFinite(clockMinutes(sunsetLabel))) {
      return { level:"unknown", reason:"no_forecast", rain_mm_max:null, rain_mm_typical:null, points:[] };
    }

    const criticalAgeNow = ageMinutes(criticalData.generated_at || criticalData.local_generated_at);
    if (!Number.isFinite(criticalAgeNow) || criticalAgeNow > 720) {
      return { level:"unknown", reason:"stale_forecast", rain_mm_max:null, rain_mm_typical:null, points:[] };
    }

    const sunsetMin = clockMinutes(sunsetLabel);
    const westIds = ["duong_dong","cua_can","ganh_dau","an_thoi"];
    const rows = [];

    westIds.forEach(id => {
      const point = criticalData?.points?.[id];
      const today = Array.isArray(point?.today) ? point.today : [];
      let best = null;
      today.forEach(row => {
        const d = new Date(row?.t || "");
        if (!Number.isFinite(d.getTime())) return;
        const parts = new Intl.DateTimeFormat("en-GB", {
          timeZone:"Asia/Ho_Chi_Minh", hour:"2-digit", minute:"2-digit", hour12:false
        }).formatToParts(d);
        const hour = Number(parts.find(p => p.type === "hour")?.value || 0);
        const minute = Number(parts.find(p => p.type === "minute")?.value || 0);
        const diff = Math.abs(hour * 60 + minute - sunsetMin);
        if (!best || diff < best.diff) best = { diff, row };
      });
      if (!best || best.diff > 180 || !Number.isFinite(Number(best.row?.rain))) return;
      rows.push({
        id,
        name:point?.name || id,
        rain:Number(best.row.rain),
        time:best.row.t
      });
    });

    if (!rows.length) {
      return { level:"unknown", reason:"no_sunset_window", rain_mm_max:null, rain_mm_typical:null, points:[] };
    }

    const rainValues = rows.map(x => x.rain).sort((a,b) => a-b);
    const rainMax = Math.max(...rainValues);
    const mid = Math.floor(rainValues.length / 2);
    const rainTypical = rainValues.length % 2
      ? rainValues[mid]
      : (rainValues[mid - 1] + rainValues[mid]) / 2;

    const freshNowcast = criticalAgeNow <= 120;
    const convection = freshNowcast
      ? westIds.map(id => String(criticalData?.points?.[id]?.nowcast?.convective_level || "").toUpperCase()).filter(Boolean)
      : [];
    const highConvective = convection.includes("HIGH");
    const elevatedConvective = convection.includes("ELEVATED");

    let level = "good";
    let reason = "low_rain";
    if (highConvective || rainMax >= 2 || rainTypical >= 1.5) {
      level = "bad";
      reason = highConvective ? "convective" : "rain";
    } else if (elevatedConvective || rainMax >= 0.5 || rainTypical >= 0.3) {
      level = "watch";
      reason = elevatedConvective ? "convective" : "rain";
    }

    return {
      level,
      reason,
      rain_mm_max:Number(rainMax.toFixed(2)),
      rain_mm_typical:Number(rainTypical.toFixed(2)),
      points:rows
    };
  }


  function buildAirportWatchSummary(airport, eventsText = "") {
    const records = Array.isArray(airport?.records) ? airport.records : [];
    const now = vnClockParts().minutes;
    const fold = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toUpperCase().replace(/\s+/g, " ").trim();
    const mins = value => {
      const m = String(value || "").match(/(\d{1,2}):(\d{2})/);
      return m ? Number(m[1]) * 60 + Number(m[2]) : null;
    };
    const scheduledTime = r => r?.scheduled_time || r?.times?.[0] || null;
    const isDelayed = r => /DELAYED|RESCHEDULED|POSTPONED/.test(String(r?.status_code || "").toUpperCase()) || /TRE|DELAYED|RESCHEDULED|HOAN/.test(fold(r?.status || ""));
    const expectedTime = r => {
      if (r?.estimated_time) return r.estimated_time;
      if (!isDelayed(r)) return null;
      const times = Array.isArray(r?.times) ? r.times : [];
      return times.length > 1 ? times[times.length - 1] : null;
    };
    const signedDiff = (from, to) => {
      const a = mins(from), b = mins(to);
      if (a == null || b == null) return null;
      let d = b - a;
      if (d > 720) d -= 1440;
      if (d < -720) d += 1440;
      return d;
    };
    const deviation = r => {
      const expected = expectedTime(r);
      return expected ? signedDiff(scheduledTime(r), expected) : null;
    };
    const completed = r => {
      const code = String(r?.status_code || "").toUpperCase();
      const raw = fold(r?.status || r?.raw_status || "");
      if (r?.direction === "arrival") return !!r?.actual_time || /ARRIVED|ON_BLOCK/.test(code) || /DA HA CANH|BAI DO/.test(raw);
      return !!r?.actual_time || code === "DEPARTED" || /DA CAT CANH/.test(raw);
    };
    const minutesAfter = value => {
      const t = mins(value);
      if (t == null) return null;
      let d = now - t;
      if (d < 0) d += 1440;
      return d;
    };
    const flightKey = r => String(r?.direction || "") + "|" + String(r?.operating_flight_number || r?.flight_number || "");
    const clean = value => {
      const s = String(value ?? "").trim();
      return s && s !== "-" && s.toLowerCase() !== "null" ? s : "";
    };

    const items = [];
    const byKey = new Map(records.map(r => [flightKey(r), r]));
    const latestByField = new Map();
    const fields = {
      gate:{current:"gate",history:"gate"},
      checkin_row:{current:"checkin_row",history:"ckRow"},
      belt:{current:"belt",history:"belt"}
    };

    for (const line of String(eventsText || "").split("\n")) {
      if (!line.trim()) continue;
      let ev;
      try { ev = JSON.parse(line); } catch (_) { continue; }
      if (ev?.type !== "CHANGED" || !ev?.changes) continue;
      const eventDay = (() => {
        try { return vnDateKey(new Date(ev.at)); } catch (_) { return ""; }
      })();
      if (eventDay !== vnDateKey()) continue;
      const key = String(ev.direction || "") + "|" + String(ev.flight_number || "");
      const record = byKey.get(key);
      if (!record) continue;

      for (const [field, cfg] of Object.entries(fields)) {
        const ch = ev.changes[cfg.history];
        if (!ch) continue;
        const from = clean(ch.from), to = clean(ch.to);
        if (!from || !to || from === to || clean(record[cfg.current]) !== to) continue;
        const k = key + "|" + field;
        const candidate = {at:ev.at, field, record};
        const previous = latestByField.get(k);
        if (!previous || new Date(candidate.at).getTime() > new Date(previous.at).getTime()) latestByField.set(k, candidate);
      }
    }

    for (const e of latestByField.values()) {
      const r = e.record;
      if (r.direction === "departure" && e.field === "belt") continue;
      if (r.direction === "arrival" && (e.field === "checkin_row" || e.field === "gate")) continue;
      if (r.direction === "departure" && completed(r)) continue;
      if (r.direction === "arrival" && completed(r)) {
        if (e.field !== "belt") continue;
        const after = minutesAfter(r.actual_time);
        if (after == null || after > 60) continue;
      }
      items.push({kind:"fids", flight:flightKey(r)});
    }

    let delayed15Count = 0;
    let delayed30Count = 0;
    let cancelledCount = 0;
    for (const r of records) {
      const sched = mins(scheduledTime(r));
      if (sched == null) continue;
      const cancelled = /CANCELLED/.test(String(r?.status_code || "").toUpperCase()) || /HUY|CANCELLED/.test(fold(r?.status || ""));
      if (completed(r) && !cancelled) continue;
      if (cancelled) {
        const after = minutesAfter(scheduledTime(r));
        if (after != null && after > 60 && after < 720) continue;
        cancelledCount += 1;
      }
      const dev = deviation(r);
      if (!cancelled && !isDelayed(r) && !(dev != null && Math.abs(dev) >= 10)) continue;
      items.push({kind:"flight", flight:flightKey(r)});

      let delay = Number.isFinite(Number(r?.delay_minutes)) ? Number(r.delay_minutes) : null;
      if (delay == null && Number.isFinite(Number(r?.estimated_delay_minutes))) delay = Number(r.estimated_delay_minutes);
      if ((delay == null || delay === 0) && dev != null && dev > 0) delay = dev;
      if (delay != null && delay >= 15) delayed15Count += 1;
      if (delay != null && delay >= 30) delayed30Count += 1;
    }

    return {
      count:items.length,
      flightCount:new Set(items.map(x => x.flight).filter(Boolean)).size,
      delayed15Count,
      delayed30Count,
      cancelledCount
    };
  }

  Promise.allSettled([
    getJson(SRC.critical),
    getJson(SRC.marineOps),
    getAirport(),
    getText(SRC.airportHistoryBase + "/" + vnDateKey() + "/events.jsonl"),
    getJson("data/operational-notices.json")
  ]).then(([c, m, a, e, n]) => {
    const critical = c.status === "fulfilled" ? c.value : null;
    const marine = m.status === "fulfilled" ? m.value : null;
    const airport = a.status === "fulfilled" ? a.value : null;
    const notices = n.status === "fulfilled" ? n.value : null;

    const vvpq = critical?.actual?.vvpq || null;
    const dd = critical?.points?.duong_dong || null;
    const anThoi = critical?.points?.an_thoi || null;
    const criticalStamp = critical?.generated_at || critical?.local_generated_at || null;
    const criticalAge = ageMinutes(criticalStamp);
    const decisionSignals = window.OpenPQDecisionSignals;
    const islandDecision = decisionSignals?.islandWeather?.(critical) ||
      {status:"unknown",convective_levels:[],observed_rain:false,valid_gauges:[]};

    const weatherTemp = vvpq?.temperature_c ?? dd?.local?.temperature_c ?? null;
    const weatherWind = vvpq?.wind_kmh ?? dd?.local?.wind_kmh ?? null;
    const weatherObservedAt = vvpq?.observed_at || criticalStamp;
    const weatherAge = ageMinutes(weatherObservedAt);
    const weatherSource = vvpq ? "Quan trắc sân bay" : dd?.local?.temperature_class === "ESTIMATED_NOW" ? "Ước tính hiện tại" : "JoTrip Weather";
    const weatherPrimary = weatherTemp != null ? Math.round(weatherTemp) + "°" : "--";
    const weatherSecondary = weatherTemp != null
      ? (weatherWind != null ? "Gió " + Math.round(weatherWind) + " km/h · " : "") + weatherSource.toLowerCase()
      : "Chưa có thông tin thời tiết mới";
    const weatherState = weatherAge > 180 || islandDecision.status === "unknown" ? "unknown" :
      islandDecision.status === "normal" && weatherAge <= 60 ? "good" : "watch";

    setLive("weather", weatherPrimary, weatherSecondary, weatherState, freshnessText(weatherObservedAt));
    setContext("weather", weatherPrimary, weatherSecondary, weatherState);

    const seaHs = anThoi?.model?.wave_hs_m ?? anThoi?.local?.wave_hs_m ?? null;
    const seaHmax = anThoi?.model?.wave_hmax_m ?? null;
    const seaTime = anThoi?.model?.marine_sampled_time || criticalStamp;
    const seaAge = ageMinutes(seaTime);
    const seaPrimary = seaHs != null ? fmt(seaHs) + " m" : "--";
    const seaSecondary = seaHs != null
      ? "Sóng Nam đảo · dự báo biển"
      : "Chưa có thông tin biển mới";
    setLive("sea", seaPrimary, seaSecondary, seaAge <= 360 ? "info" : "unknown", freshnessText(seaTime));

    const marineStamp = marine?.collected_at_vn || marine?.generated_at || null;
    const marineAge = ageMinutes(marineStamp);
    const canoEvidence = decisionSignals?.marineCategory?.(marine,"cano");
    const canoState = canoEvidence?.state || "UNKNOWN";
    setLive(
      "cano",
      marine ? stateText(canoState) : "Chưa có tin mới",
      !marine ? "Chưa có cập nhật hôm nay" : canoState === "FIELD_REQUIRED" ? "Chưa có cập nhật hôm nay" : "Cano Nam đảo",
      !marine ? "unknown" : ["RUNNING", "DIRECT_CONFIRMED"].includes(canoState) ? "good" : canoState === "SUSPENDED" ? "bad" : canoState === "FIELD_REQUIRED" ? "watch" : "unknown",
      marine ? freshnessText(marineStamp) : "Chưa biết lần cập nhật gần nhất"
    );

    const sunset = sunsetFor();
    setLive("sunset", sunset, "Bờ Tây · tính theo vị trí đảo", "info");
    setContext("sunset", sunset, "Bờ Tây · tính theo vị trí đảo", "info");

    // Island summary considers fresh point evidence from Phú Quốc only;
    // it never imports a stale offshore signal or Rạch Giá as current island rain.
    const convectiveLevels = islandDecision.convective_levels;
    const hasHighConvective = convectiveLevels.some(x => ["HIGH","SEVERE","EXTREME"].includes(x));
    const hasElevatedConvective = convectiveLevels.some(x => ["ELEVATED","WATCH","MODERATE"].includes(x));
    const hasWatchConvective = convectiveLevels.includes("WATCH");

    const gauges = islandDecision.valid_gauges;
    const observedRain = islandDecision.observed_rain;
    const heroRain = window.OpenPQHeroContext?.assessHeavyRain?.(gauges,criticalAge)
      || {confirmed:false,count:0};

    let nowSuggestionSlides = [];
    let nowSuggestionIndex = 0;
    let nowSuggestionTimer = null;

    function buildNowSuggestions() {
      const now = vnClockParts();
      const todaySunset = sunsetFor();
      const sunsetMinute = clockMinutes(todaySunset);
      const minutesToSunset = Number.isFinite(sunsetMinute) ? sunsetMinute - now.minutes : NaN;
      const localHint = window.OPENPQ_HOME_LOCAL?.now_hint || null;
      const slides = [];

      const push = cfg => {
        if (!cfg || !cfg.title) return;
        const key = (cfg.title + "|" + (cfg.primaryHref || "")).toLowerCase();
        if (slides.some(x => x._key === key)) return;
        slides.push({...cfg, _key:key});
      };

      const currentCriticalAge = ageMinutes(criticalStamp);
      if (critical && currentCriticalAge <= 90 && (hasHighConvective || hasElevatedConvective || observedRain)) {
        push({
          tone:"watch",
          title:"Nếu đi ngoài trời, giữ lịch linh hoạt.",
          note:"Thời tiết có dấu hiệu thay đổi. Ưu tiên nơi dễ đổi kế hoạch nếu mưa tới.",
          primaryText:"Xem thời tiết →", primaryHref:"weather/",
          secondaryText:"Tìm chỗ dễ đổi lịch", secondaryHref:"explore/?intent=rainy-day"
        });
      } else if (canoState === "SUSPENDED") {
        push({
          tone:"watch",
          title:"Hôm nay nên ưu tiên lịch trên bờ.",
          note:"Cano đang tạm dừng. Chọn một điểm ít phụ thuộc biển sẽ nhẹ lịch hơn.",
          primaryText:"Xem tình trạng cano →", primaryHref:"cano/",
          secondaryText:"Chọn chỗ trên bờ", secondaryHref:"explore/?intent=rainy-day"
        });
      } else if (localHint?.priority === "deadline") {
        push({...localHint});
      } else if (now.minutes < 12 * 60) {
        push({
          tone:"default",
          title:"Buổi sáng, chọn một hướng rồi đi.",
          note:"Chọn Bắc, trung tâm hoặc Nam đảo làm trục sẽ đỡ mất thời gian chạy qua lại.",
          primaryText:"Chọn nơi đi →", primaryHref:"explore/",
          secondaryText:"Xem tình hình đảo", secondaryHref:"#today"
        });
      } else if (now.minutes < 17 * 60) {
        push({
          tone:"default",
          title:"Chiều nay chỉ nên chọn thêm một điểm vừa sức.",
          note:"Chọn một điểm hợp giờ này rồi chừa thời gian cho cuối chiều, đừng chạy vòng cả đảo.",
          primaryText:"Chọn nơi đi →", primaryHref:"explore/",
          secondaryText:"Xem còn kịp gì", secondaryHref:"#happening"
        });
      } else {
        push({
          tone:"default",
          title:"Tối nay cứ chọn một khu rồi đi chậm lại.",
          note:"Ăn tối hoặc đi bộ gần nơi bạn ở. Nếu muốn xem show, hãy kiểm tra thông báo từng suất." ,
          primaryText:"Xem tối nay có gì →", primaryHref:"#happening",
          secondaryText:"Tìm món ăn", secondaryHref:"food/"
        });
      }

      if (Number.isFinite(minutesToSunset) && minutesToSunset > 0 && minutesToSunset <= 240) {
        const sunsetWx = sunsetWeatherAssessment(critical, todaySunset);
        if (sunsetWx.level === "bad") {
          push({
            tone:"watch",
            title:"Hoàng hôn chiều nay có thể bị mưa ảnh hưởng.",
            note:"Bờ Tây có tín hiệu mưa hoặc dông gần giờ hoàng hôn. Quan sát thêm dự báo trước khi di chuyển.",
            primaryText:"Xem mưa chiều nay →", primaryHref:"weather/",
            secondaryText:"Xem còn kịp gì", secondaryHref:"#happening"
          });
        } else if (sunsetWx.level === "watch") {
          push({
            tone:"watch",
            title:minutesToSunset <= 120
              ? "Còn khoảng " + minutesToSunset + " phút tới hoàng hôn, nhưng có thể có mưa."
              : "Cuối chiều có thể có mưa cục bộ ở bờ Tây.",
            note:"Cuối chiều có thể có mưa cục bộ. Quan sát thêm dự báo trước khi di chuyển.",
            primaryText:"Xem mưa chiều nay →", primaryHref:"weather/",
            secondaryText:"Xem điểm gần hơn", secondaryHref:"nearme/"
          });
        } else {
          push({
            tone:"sunset",
            title:minutesToSunset <= 120
              ? "Còn khoảng " + minutesToSunset + " phút tới hoàng hôn."
              : "Cuối chiều nay, chừa thời gian cho hoàng hôn.",
            note:minutesToSunset <= 120
              ? "Quan sát thêm dự báo trước khi di chuyển."
              : "Quan sát thêm dự báo trước khi di chuyển.",
            primaryText:"Xem điểm cuối chiều →", primaryHref:"explore/?intent=evening",
            secondaryText:"Xem còn kịp gì", secondaryHref:"#happening"
          });
        }
      }

      if (now.minutes < 20 * 60) {
        push({
          tone:"default",
          title:"Tối nay vẫn còn nhiều lựa chọn.",
          note:"Chợ đêm, ăn uống, đi bộ và các show tối phù hợp hơn với một lịch nhẹ.",
          primaryText:"Xem tối nay →", primaryHref:"#happening",
          secondaryText:"Bây giờ ăn gì?", secondaryHref:"#food-now"
        });
      } else if (now.minutes < 21 * 60) {
        push({
          tone:"default",
          title:"Tối nay vẫn còn chỗ để đi.",
          note:"Chợ đêm, ăn uống hoặc đi bộ gần vẫn là lựa chọn. Muốn xem show, kiểm tra thông báo từng suất." ,
          primaryText:"Xem tối nay →", primaryHref:"#happening",
          secondaryText:"Bây giờ ăn gì?", secondaryHref:"#food-now"
        });
      } else {
        push({
          tone:"default",
          title:"Giờ này hợp ăn uống và đi bộ hơn.",
          note:"Muốn xem show thì kiểm tra giờ trước khi chạy tới; nhiều show tối đã vào giờ.",
          primaryText:"Tìm món ăn →", primaryHref:"#food-now",
          secondaryText:"Khám phá gần đây", secondaryHref:"nearme/"
        });
      }

      if (slides.length < 3) {
        push({
          tone:"default",
          title:"Muốn đi gần hơn? Chọn khu vực trước.",
          note:"Dương Đông, An Thới, Sunset Town hay Gành Dầu đều có thể xem riêng, không cần bật GPS.",
          primaryText:"Xem quanh đây →", primaryHref:"nearme/",
          secondaryText:"Mở khám phá", secondaryHref:"explore/"
        });
      }

      return slides.slice(0,3);
    }

    function paintNowSuggestion(index = 0) {
      const card = document.querySelector("[data-now-card]");
      if (!card || !nowSuggestionSlides.length) return;
      const cfg = nowSuggestionSlides[index % nowSuggestionSlides.length];
      const now = vnClockParts();
      const kicker = card.querySelector("[data-now-kicker]");
      const time = card.querySelector("[data-now-time]");
      const title = card.querySelector("[data-now-title]");
      const note = card.querySelector("[data-now-note]");
      const primary = card.querySelector("[data-now-primary]");
      const secondary = card.querySelector("[data-now-secondary]");
      const pager = card.querySelector("[data-now-pager]");

      card.dataset.tone = cfg.tone || "default";
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
      if (pager) {
        pager.hidden = nowSuggestionSlides.length < 2;
        pager.innerHTML = nowSuggestionSlides.map((_, i) =>
          '<button type="button" data-now-slide="'+i+'" class="'+(i===index?"is-active":"")+'" aria-label="Gợi ý '+(i+1)+'"></button>'
        ).join("");
      }
    }

    function renderNowSuggestion() {
      const card = document.querySelector("[data-now-card]");
      if (!card) return;
      nowSuggestionSlides = buildNowSuggestions();
      nowSuggestionIndex = Math.min(nowSuggestionIndex, Math.max(0, nowSuggestionSlides.length - 1));
      if (!nowSuggestionSlides.length) {
        card.hidden = true;
        return;
      }
      card.hidden = false;
      paintNowSuggestion(nowSuggestionIndex);
      if (nowSuggestionTimer) clearInterval(nowSuggestionTimer);
      if (nowSuggestionSlides.length > 1) {
        nowSuggestionTimer = setInterval(() => {
          nowSuggestionIndex = (nowSuggestionIndex + 1) % nowSuggestionSlides.length;
          paintNowSuggestion(nowSuggestionIndex);
        }, 8000);
      }
    }

    const nowCard = document.querySelector("[data-now-card]");
    if (nowCard) {
      nowCard.addEventListener("click", e => {
        const b = e.target.closest("[data-now-slide]");
        if (!b) return;
        nowSuggestionIndex = Number(b.dataset.nowSlide) || 0;
        paintNowSuggestion(nowSuggestionIndex);
        if (nowSuggestionTimer) {
          clearInterval(nowSuggestionTimer);
          nowSuggestionTimer = setInterval(() => {
            nowSuggestionIndex = (nowSuggestionIndex + 1) % nowSuggestionSlides.length;
            paintNowSuggestion(nowSuggestionIndex);
          }, 8000);
        }
      });
    }

    renderNowSuggestion();
    window.addEventListener("openpq:local-ready", renderNowSuggestion);
    setInterval(renderNowSuggestion, 60000);

    let wxTitle = "Chưa có thông tin thời tiết mới";
    let wxNote = "Mở Thời tiết & Biển để xem tình hình và lần cập nhật gần nhất.";
    let wxBadge = "CHƯA CÓ";
    let wxGood = false;

    if (critical) {
      wxNote = weatherSecondary;
      if (criticalAge > 90) {
        wxTitle = "Chưa xem được thời tiết mới nhất";
        wxBadge = "TIN ĐÃ CŨ";
      } else if (hasHighConvective) {
        wxTitle = "Dông mạnh có thể phát triển nhanh";
        wxBadge = "THEO DÕI";
      } else if (hasElevatedConvective) {
        wxTitle = "Mây dông đang dày lên";
        wxBadge = "LƯU Ý";
      } else if (observedRain) {
        wxTitle = "Một số điểm trên đảo đang có mưa";
        wxBadge = "ĐANG MƯA";
      } else if (islandDecision.status === "normal") {
        wxTitle = "Chưa thấy tín hiệu thời tiết nổi bật tại các điểm đang theo dõi";
        wxBadge = "CHƯA CÓ TÍN HIỆU";
        wxGood = weatherState === "good";
      } else {
        wxTitle = "Chưa đủ dữ liệu thời tiết mới tại các điểm đang theo dõi";
        wxBadge = "CHƯA RÕ";
      }
    }

    setHappening("weather", wxTitle, wxNote, wxBadge, wxGood);

    const ferryEvidence = decisionSignals?.marineCategory?.(marine,"ferry");
    const fastEvidence = decisionSignals?.marineCategory?.(marine,"fast_boat");
    const ferryState = ferryEvidence?.state || "UNKNOWN";
    const fastState = fastEvidence?.state || "UNKNOWN";
    const operationalStates = [canoState, fastState, ferryState].filter(Boolean);
    // Individual port clearance proves a reported departure, never an all-day
    // guarantee that every ferry or fast-boat sailing will operate.
    const marineOverall = !marine || !operationalStates.length || marineAge > 1440
      ? "unknown"
      : operationalStates.some(x => x === "SUSPENDED" || x === "FIELD_REQUIRED")
        ? "watch"
        : operationalStates.every(x => x === "RUNNING") ? "normal" : "unknown";

    const operationalFreshness = [canoEvidence,fastEvidence,ferryEvidence].some(x => !x || x.freshness === "stale")
      ? "stale" : [canoEvidence,fastEvidence,ferryEvidence].some(x => x.freshness === "aging") ? "aging" : "fresh";
    const transitStates = [fastState, ferryState];
    const transitGood = transitStates.every(x => ["RUNNING", "DIRECT_CONFIRMED"].includes(x));
    const transitRunning = transitStates.every(x => x === "RUNNING");
    const transitBad = transitStates.some(x => x === "SUSPENDED");
    const transitWatch = transitStates.some(x => x === "FIELD_REQUIRED" || x === "UNKNOWN" || !x);
    const transitPrimary = !marine ? "Chưa biết chắc hôm nay" : transitBad ? "Hôm nay có thay đổi" : transitWatch ? "Nên xem lại trước khi đi" : transitRunning ? "Hôm nay hoạt động bình thường" : transitGood ? "Đã ghi nhận chuyến hoạt động" : "Chưa biết chắc";
    const transitContext = !marine ? "Chưa có tin mới" : transitRunning ? "Tàu cao tốc và phà đều được xác nhận hoạt động hôm nay" : transitGood ? "Đã có chuyến được xác nhận; xem trạng thái từng chuyến trước khi đặt" : "Tàu cao tốc " + stateText(fastState).toLowerCase() + " · Phà " + stateText(ferryState).toLowerCase();
    setLive("ferry", transitPrimary, transitContext, !marine ? "unknown" : transitBad || transitWatch ? "watch" : transitRunning ? "good" : transitGood ? "info" : "unknown", marine ? freshnessText(marineStamp) : "Chưa có tin mới");

    if (!marine) {
      setHappening("marine", "Chưa có tin mới về tàu và phà", "Mở Tàu & Phà để xem thông tin gần nhất.", "CHƯA BIẾT", false);
    } else if (transitBad) {
      setHappening("marine", "Tàu hoặc phà có thay đổi hôm nay", transitContext, "LƯU Ý", false);
    } else {
      setHappening("marine", transitRunning ? "Tàu và phà chạy bình thường" : transitGood ? "Đã ghi nhận chuyến tàu và phà hôm nay" : "Nên xem lại lịch trước khi đi", transitContext, transitRunning ? "BÌNH THƯỜNG" : transitGood ? "CÓ CHUYẾN" : "XEM LẠI", transitRunning);
    }

    const airportStamp = airport?.collected_at_vn || airport?.generated_at || null;
    const airportAge = ageMinutes(airportStamp);
    const airportQaUsable = airport?.quality?.usable !== false;
    const airportAvailable = !!airport && airportQaUsable && airportAge <= 15;
    const airportLoaded = !!airport;
    const records = airportAvailable ? (airport.records || []) : [];
    const total = airportAvailable ? (airport?.counts?.total ?? records.length) : null;
    const airportEventsText = e.status === "fulfilled" ? e.value : "";
    const airportWatch = airportAvailable ? buildAirportWatchSummary(airport, airportEventsText) : {
      count:0, flightCount:0, delayed15Count:0, delayed30Count:0, cancelledCount:0
    };
    const attentionLine = airportWatch.count
      ? airportWatch.count + " cảnh báo đang cần chú ý"
      : "Chưa có cảnh báo đáng chú ý";

    setHappening(
      "airport",
      !airportAvailable ? "Sân bay chưa có cập nhật mới" : "Sân bay đang hoạt động ổn định",
      airportAvailable ? attentionLine + " · " + total + " chuyến hôm nay" : "Mở Sân bay để xem các chuyến hôm nay.",
      !airportAvailable ? "CHƯA BIẾT" : airportWatch.count ? "CẦN CHÚ Ý" : "BÌNH THƯỜNG",
      airportAvailable
    );

    setContext(
      "airport",
      !airportAvailable ? "Chưa có thông tin mới" : "Hoạt động ổn định",
      airportAvailable ? attentionLine + " · " + total + " chuyến hôm nay" : "Mở Sân bay để xem thêm",
      !airportAvailable ? "unknown" : airportWatch.count ? "watch" : "good"
    );

    setLive(
      "airport",
      !airportAvailable ? "Chưa có thông tin mới" : "Hoạt động ổn định",
      airportAvailable ? attentionLine + " · " + total + " chuyến hôm nay" : "Mở Sân bay để xem các chuyến hôm nay",
      !airportAvailable ? "unknown" : airportWatch.count ? "watch" : "good",
      airportLoaded ? freshnessText(airportStamp) : "Chưa có tin mới"
    );

    setLive("bus", "Tìm tuyến xe phù hợp", "Tuyến, điểm đón và giờ chạy", "info", "Lịch chạy theo tuyến");

    const quickAlerts = [];
    const weatherFreshForAlert = !!critical && criticalAge <= 90;
    if (weatherFreshForAlert && hasHighConvective) {
      quickAlerts.push({
        label:"THỜI TIẾT",
        text:"Mưa dông mạnh có thể phát triển nhanh ở một số khu vực.",
        href:"weather/",
        action:"Xem thời tiết",
        priority:100,
        level:"alert"
      });
    } else if (weatherFreshForAlert && hasElevatedConvective) {
      quickAlerts.push({
        label:"THỜI TIẾT",
        text:"Mây đối lưu đang tăng. Nếu phải đi xa, nên xem khu vực mình sắp tới.",
        href:"weather/",
        action:"Xem thời tiết",
        priority:80,
        level:"watch"
      });
    } else if (weatherFreshForAlert && observedRain) {
      quickAlerts.push({
        label:"THỜI TIẾT",
        text:"Có nơi trên đảo đang ghi nhận mưa. Xem khu vực mình sắp đi trước khi chạy xa.",
        href:"weather/",
        action:"Xem thời tiết",
        priority:60,
        level:"watch"
      });
    }
    if (canoState === "SUSPENDED") {
      quickAlerts.push({
        label:"CANO",
        text:"Cano Nam đảo hôm nay đang tạm dừng.",
        href:"cano/",
        action:"Xem tình hình cano",
        priority:95,
        level:"alert"
      });
    }
    if (fastState === "SUSPENDED") {
      quickAlerts.push({
        label:"TÀU CAO TỐC",
        text:"Tàu cao tốc có thay đổi hôm nay.",
        href:"transit/",
        action:"Xem lịch tàu",
        priority:90,
        level:"alert"
      });
    }
    if (ferryState === "SUSPENDED") {
      quickAlerts.push({
        label:"PHÀ",
        text:"Phà có thay đổi hôm nay.",
        href:"transit/",
        action:"Xem lịch phà",
        priority:90,
        level:"alert"
      });
    }
    if (airportAvailable && (airportWatch.cancelledCount > 0 || airportWatch.delayed30Count >= 3)) {
      const airportIssueText = airportWatch.cancelledCount > 0
        ? "Có chuyến bị hủy hoặc thay đổi đáng kể. Nếu sắp ra sân bay, nên xem lại chuyến của mình."
        : airportWatch.delayed30Count + " chuyến đang chậm từ 30 phút. Nếu sắp ra sân bay, nên xem lại chuyến của mình.";
      quickAlerts.push({
        label:"SÂN BAY",
        text:airportIssueText,
        href:"airport/",
        action:"Xem chuyến bay",
        priority:50,
        level:"watch"
      });
    }
    const topAlert = quickAlerts.sort((a,b) => b.priority - a.priority)[0] || null;
    const tickerBaseItems = [];
    if (topAlert) tickerBaseItems.push(["LƯU Ý", topAlert.text]);
    tickerBaseItems.push(
      ["THỜI TIẾT", critical ? weatherPrimary + " · " + (criticalAge > 90 ? "cần cập nhật" : weatherSource) : "chưa có thông tin mới"],
      ["BIỂN NAM ĐẢO", seaHs != null ? fmt(seaHs) + " m" : "chưa có thông tin mới"],
      ["CANO", marine ? stateText(canoState) : "chưa có cập nhật mới"],
      ["SÂN BAY", !airportAvailable ? "chưa có tin mới lúc này" : airportWatch.count ? "hoạt động ổn định · " + airportWatch.count + " cảnh báo cần chú ý" : "hoạt động ổn định"],
      ["HOÀNG HÔN", sunset]
    );
    // One line in the existing header ticker, scoped to the affected show date.
    let lastTickerDay = "";
    const refreshDatedTicker = () => {
      const today = vnDateKey();
      if(today === lastTickerDay)return;
      lastTickerDay = today;
      const canceled = (notices?.notices || []).find(x => x.status === "CANCELLED" && x.date === today);
      const datedLine = canceled ? [["SHOW TỐI NAY", canceled.title + " · Xem thông báo", "news/"]] : [];
      renderTicker([...datedLine,...tickerBaseItems], canceled ? "watch" : (topAlert?.level || "normal"));
    };
    refreshDatedTicker();
    setInterval(refreshDatedTicker,60000);

    const pulseDot = document.querySelector(".island-pulse .live-dot");
    if (pulseDot) {
      const hasOperationalAlert = (weatherFreshForAlert && hasHighConvective) || [canoState, fastState, ferryState].includes("SUSPENDED");
      pulseDot.dataset.level = hasOperationalAlert ? "alert" : quickAlerts.length ? "noteworthy" : "normal";
    }

    const decisionCard = document.querySelector("[data-decision-card]");
    if (decisionCard) {
      const tag = decisionCard.querySelector("span");
      const title = decisionCard.querySelector("strong");
      const note = decisionCard.querySelector("small");
      const img = decisionCard.querySelector("img");

      if (!critical || criticalAge > 90) {
        decisionCard.href = "weather/";
        if (tag) tag.textContent = "KIỂM TRA TRƯỚC";
        if (title) title.textContent = "Chưa xem được thời tiết mới nhất";
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
          label: "Thời tiết",
          primary: weatherPrimary,
          context: weatherSecondary,
          secondary: weatherSecondary,
          status: islandDecision.status,
          source_class: vvpq ? "ACTUAL" : "ESTIMATED_NOW",
          source_updated_at: weatherObservedAt,
          freshness: weatherAge <= 60 ? "fresh" : weatherAge <= 180 ? "aging" : "stale",
          detail_url: "weather/"
        },
        sea: {
          label: "Biển",
          primary: seaPrimary,
          context: seaSecondary,
          secondary: seaSecondary,
          status: seaHs == null || seaAge > 720 ? "unknown" : "info",
          source_class: "MODEL",
          source_updated_at: seaTime,
          freshness: seaAge <= 360 ? "fresh" : seaAge <= 720 ? "aging" : "stale",
          detail_url: "weather/#marine"
        },
        cano: {
          label: "Cano",
          primary: marine ? stateText(canoState) : "Chưa có thông tin mới",
          context: !marine ? "Chưa có cập nhật hôm nay" : canoState === "FIELD_REQUIRED" ? "Chưa có cập nhật hôm nay" : "Khu vực Nam đảo",
          status: !marine ? "unknown" : ["RUNNING", "DIRECT_CONFIRMED"].includes(canoState) ? "normal" : ["SUSPENDED", "FIELD_REQUIRED"].includes(canoState) ? "watch" : "unknown",
          source_class: "DIRECT_OPERATIONAL",
          source_updated_at: marineStamp,
          freshness: canoEvidence?.freshness || "unknown",
          detail_url: "cano/"
        },
        ferry: {
          label: "Tàu & Phà",
          primary: ferryState === "DIRECT_CONFIRMED" ? "Đã ghi nhận chuyến rời cảng" : marine ? stateText(ferryState) : "Chưa có thông tin mới",
          context: !marine ? "Hôm nay chưa có tin mới" : "Phà hôm nay xem riêng từng chuyến",
          status: !marine ? "unknown" : ferryState === "RUNNING" ? "normal" : ["SUSPENDED", "FIELD_REQUIRED"].includes(ferryState) ? "watch" : "unknown",
          source_class: "DIRECT_OPERATIONAL",
          source_updated_at: marineStamp,
          freshness: ferryEvidence?.freshness || "unknown",
          detail_url: "transit/"
        },
        transport: {
          primary: marineOverall === "normal" ? "Hôm nay chưa thấy gián đoạn lớn" : marineOverall === "watch" ? "Có dịch vụ cần xem lại" : transitGood ? "Đã ghi nhận chuyến hoạt động" : "Chưa có đủ thông tin",
          status: marineOverall,
          source_class: "DIRECT_OPERATIONAL",
          source_updated_at: marineStamp,
          freshness: operationalFreshness,
          categories: {
            cano: canoState || "UNKNOWN",
            fast_boat: fastState || "UNKNOWN",
            ferry: ferryState || "UNKNOWN"
          }
        },
        marine: {
          primary: marine ? stateText(canoState) : "Chưa có thông tin mới",
          status: !marine ? "unknown" : canoState === "RUNNING" || canoState === "DIRECT_CONFIRMED" ? "normal" : canoState === "SUSPENDED" || canoState === "FIELD_REQUIRED" ? "watch" : "unknown",
          source_class: "MIXED"
        },
        airport: {
          label: "Sân bay",
          primary: !airportAvailable ? "Chưa có tin mới lúc này" : "Hoạt động ổn định",
          context: airportAvailable ? attentionLine + " · " + total + " chuyến hôm nay" : airportLoaded ? "Chưa có tin mới" : "Chưa xem được sân bay lúc này",
          status: !airportAvailable ? "unknown" : airportWatch.count ? "watch" : "normal",
          source_class: "LIVE_OPERATIONAL",
          source_updated_at: airportStamp,
          freshness: !airportLoaded || !Number.isFinite(airportAge) ? "unknown" : airportAge <= 8 ? "fresh" : airportAge <= 15 ? "aging" : "stale",
          detail_url: "airport/"
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
        heavy_rain_confirmed: heroRain.confirmed,
        heavy_rain_gauge_count: heroRain.count,
        sunset_weather: sunsetWeatherAssessment(critical, sunset),
        airport_attention_count: airportAvailable ? airportWatch.count : null,
        airport_attention_flights: airportAvailable ? airportWatch.flightCount : null,
        airport_delayed_15m_count: airportAvailable ? airportWatch.delayed15Count : null,
        airport_delayed_30m_count: airportAvailable ? airportWatch.delayed30Count : null,
        airport_cancelled_count: airportAvailable ? airportWatch.cancelledCount : null,
        airport_total: total,
        cano_state: canoState || null,
        fast_boat_state: fastState || null,
        ferry_state: ferryState || null
      },
      source_health: {
        weather_critical: c.status,
        marine_ops: m.status,
        airport: a.status,
        airport_events: e.status
      }
    };

    window.dispatchEvent(new CustomEvent("openpq:live-ready", { detail: window.OPENPQ_HOME }));
  });
})();
