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
      tonight:"Xem tối nay →"
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
      "<span>" + safe(x[0]) + "</span><b>" + safe(x[1]) + "</b><i>•</i>"
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
      ? (weatherWind != null ? "Gió " + Math.round(weatherWind) + " km/h · " : "") + weatherSource.toLowerCase()
      : "Chưa có thông tin thời tiết mới";
    const weatherState = !critical ? "unknown" : weatherAge <= 60 ? "good" : weatherAge <= 180 ? "watch" : "unknown";

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
    const canoState = marine?.categories?.cano?.state;
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

    const pointList = Object.values(critical?.points || {});
    const convectiveLevels = pointList
      .map(p => String(p?.nowcast?.convective_level || "").toUpperCase())
      .filter(Boolean);
    const hasHighConvective = convectiveLevels.includes("HIGH");
    const hasElevatedConvective = convectiveLevels.includes("ELEVATED");
    const hasWatchConvective = convectiveLevels.includes("WATCH");

    const gauges = Array.isArray(critical?.actual?.rain_gauges) ? critical.actual.rain_gauges : [];
    const observedRain = gauges.some(g => g?.rain_observed === true || Number(g?.rain_intensity_mm_h) > 0);

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
          title:"Chiều nay vẫn còn kịp thêm một điểm.",
          note:"Đừng cố chạy nhiều nơi. Chọn một điểm chính rồi chừa thời gian cho cuối chiều.",
          primaryText:"Chọn nơi đi →", primaryHref:"explore/",
          secondaryText:"Xem còn kịp gì", secondaryHref:"#happening"
        });
      } else {
        push({
          tone:"default",
          title:"Tối nay cứ chọn một khu rồi đi chậm lại.",
          note:"Ăn một món, đi bộ hoặc xem show. Không cần chạy hết đảo trong một buổi tối.",
          primaryText:"Xem tối nay có gì →", primaryHref:"#happening",
          secondaryText:"Tìm món ăn", secondaryHref:"food/"
        });
      }

      if (Number.isFinite(minutesToSunset) && minutesToSunset > 0 && minutesToSunset <= 240) {
        push({
          tone:"sunset",
          title:minutesToSunset <= 120
            ? "Còn khoảng " + minutesToSunset + " phút tới hoàng hôn."
            : "Cuối chiều nay, chừa thời gian cho hoàng hôn.",
          note:minutesToSunset <= 120
            ? "Nếu muốn ra bờ Tây, nên tính đường đi từ bây giờ."
            : "Đừng để tới sát giờ mới chạy qua bờ Tây.",
          primaryText:"Xem điểm cuối chiều →", primaryHref:"explore/?intent=evening",
          secondaryText:"Xem còn kịp gì", secondaryHref:"#happening"
        });
      }

      if (now.minutes < 19 * 60 + 30) {
        push({
          tone:"default",
          title:"Tối nay vẫn còn nhiều lựa chọn.",
          note:"Chợ đêm, ăn uống, đi bộ và các show tối phù hợp hơn với một lịch nhẹ.",
          primaryText:"Xem tối nay →", primaryHref:"#happening",
          secondaryText:"Bây giờ ăn gì?", secondaryHref:"#food-now"
        });
      } else {
        push({
          tone:"default",
          title:"Muộn rồi thì ưu tiên ăn uống và đi bộ.",
          note:"Giữ lịch nhẹ sẽ dễ chịu hơn là cố thêm một điểm xa.",
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
        wxBadge = "CẦN CẬP NHẬT";
      } else if (hasHighConvective) {
        wxTitle = "Dông mạnh có thể phát triển nhanh";
        wxBadge = "THEO DÕI";
      } else if (hasElevatedConvective) {
        wxTitle = "Mây dông đang tăng";
        wxBadge = "LƯU Ý";
      } else if (observedRain) {
        wxTitle = "Một số điểm trên đảo đang có mưa";
        wxBadge = "ĐO THỰC";
      } else {
        wxTitle = "Chưa thấy dấu hiệu thời tiết đáng lo lúc này";
        wxBadge = "CẬP NHẬT";
        wxGood = weatherState === "good";
      }
    }

    setHappening("weather", wxTitle, wxNote, wxBadge, wxGood);

    const ferryState = marine?.categories?.ferry?.state;
    const fastState = marine?.categories?.fast_boat?.state;
    const operationalStates = [canoState, fastState, ferryState].filter(Boolean);
    const marineOverall = !marine || !operationalStates.length || marineAge > 1440
      ? "unknown"
      : operationalStates.some(x => x === "SUSPENDED" || x === "FIELD_REQUIRED")
        ? "watch"
        : operationalStates.every(x => x === "RUNNING" || x === "DIRECT_CONFIRMED") ? "normal" : "unknown";

    const transitStates = [fastState, ferryState];
    const transitGood = transitStates.every(x => ["RUNNING", "DIRECT_CONFIRMED"].includes(x));
    const transitBad = transitStates.some(x => x === "SUSPENDED");
    const transitWatch = transitStates.some(x => x === "FIELD_REQUIRED" || x === "UNKNOWN" || !x);
    const transitPrimary = !marine ? "Chưa biết chắc hôm nay" : transitBad ? "Hôm nay có thay đổi" : transitWatch ? "Nên xem lại trước khi đi" : transitGood ? "Hôm nay chạy bình thường" : "Chưa biết chắc";
    const transitContext = !marine ? "Chưa có tin mới" : transitGood ? "Tàu cao tốc và phà đều chạy hôm nay" : "Tàu cao tốc " + stateText(fastState).toLowerCase() + " · Phà " + stateText(ferryState).toLowerCase();
    setLive("ferry", transitPrimary, transitContext, !marine ? "unknown" : transitBad || transitWatch ? "watch" : transitGood ? "good" : "unknown", marine ? freshnessText(marineStamp) : "Chưa có tin mới");

    if (!marine) {
      setHappening("marine", "Chưa có tin mới về tàu và phà", "Mở Tàu & Phà để xem thông tin gần nhất.", "CHƯA BIẾT", false);
    } else if (transitBad) {
      setHappening("marine", "Tàu hoặc phà có thay đổi hôm nay", transitContext, "LƯU Ý", false);
    } else {
      setHappening("marine", transitGood ? "Tàu và phà chạy bình thường" : "Nên xem lại lịch trước khi đi", transitContext, transitGood ? "BÌNH THƯỜNG" : "XEM LẠI", transitGood);
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
      !airportAvailable ? "Sân bay chưa có cập nhật mới" : delayed.length ? delayed.length + " chuyến đang trễ" : "Chưa thấy chuyến trễ đáng kể",
      airportAvailable ? total + " chuyến trong bảng hôm nay" : "Mở Sân bay để xem các chuyến hôm nay.",
      !airportAvailable ? "CHƯA BIẾT" : delayed.length ? "CÓ TRỄ" : "BÌNH THƯỜNG",
      airportAvailable && delayed.length === 0
    );

    setContext(
      "airport",
      !airportAvailable ? "Chưa có thông tin mới" : delayed.length ? delayed.length + " chuyến đang trễ" : "Chưa thấy bất thường",
      airportAvailable ? total + " chuyến hôm nay · " + ageText(airportStamp) : "Mở Sân bay để xem thêm",
      !airportAvailable ? "unknown" : delayed.length ? "watch" : "good"
    );

    setLive(
      "airport",
      !airportAvailable ? "Chưa có thông tin mới" : delayed.length ? delayed.length + " chuyến đang trễ" : "Chưa thấy bất thường",
      airportAvailable ? total + " chuyến trong bảng hôm nay" : "Mở Sân bay để xem các chuyến hôm nay",
      !airportAvailable ? "unknown" : delayed.length ? "watch" : "good",
      airportLoaded ? freshnessText(airportStamp) : "Chưa có tin mới"
    );

    setLive("tonight", "Còn nhiều lựa chọn", "Chợ đêm · show · đi dạo", "info", "Theo giờ Phú Quốc");

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
    if (airportAvailable && delayed.length >= 3) {
      quickAlerts.push({
        label:"SÂN BAY",
        text:delayed.length + " chuyến đang trễ. Nếu sắp ra sân bay, nên xem lại chuyến của mình.",
        href:"airport/",
        action:"Xem chuyến bay",
        priority:50,
        level:"watch"
      });
    }
    const topAlert = quickAlerts.sort((a,b) => b.priority - a.priority)[0] || null;
    const tickerItems = [];
    if (topAlert) tickerItems.push(["LƯU Ý", topAlert.text]);
    tickerItems.push(
      ["THỜI TIẾT", critical ? weatherPrimary + " · " + (criticalAge > 90 ? "cần cập nhật" : weatherSource) : "chưa có thông tin mới"],
      ["BIỂN NAM ĐẢO", seaHs != null ? fmt(seaHs) + " m" : "chưa có thông tin mới"],
      ["CANO", marine ? stateText(canoState) : "chưa có cập nhật mới"],
      ["SÂN BAY", !airportAvailable ? "chưa có cập nhật đủ mới" : delayed.length ? delayed.length + " chuyến cần xem" : "chưa thấy bất thường"],
      ["HOÀNG HÔN", sunset]
    );
    renderTicker(tickerItems, topAlert?.level || "normal");

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
          status: !critical || criticalAge > 90 ? "unknown" : hasHighConvective ? "watch" : (hasElevatedConvective || observedRain) ? "advisory" : "normal",
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
          freshness: !marine || !Number.isFinite(marineAge) ? "unknown" : marineAge <= 720 ? "fresh" : marineAge <= 1440 ? "aging" : "stale",
          detail_url: "cano/"
        },
        ferry: {
          label: "Tàu & Phà",
          primary: marine ? stateText(ferryState) : "Chưa có thông tin mới",
          context: !marine ? "Chưa lấy được cập nhật hôm nay" : "Tình trạng phà được kiểm tra riêng",
          status: !marine ? "unknown" : ["RUNNING", "DIRECT_CONFIRMED"].includes(ferryState) ? "normal" : ["SUSPENDED", "FIELD_REQUIRED"].includes(ferryState) ? "watch" : "unknown",
          source_class: "DIRECT_OPERATIONAL",
          source_updated_at: marineStamp,
          freshness: !marine || !Number.isFinite(marineAge) ? "unknown" : marineAge <= 720 ? "fresh" : marineAge <= 1440 ? "aging" : "stale",
          detail_url: "transit/"
        },
        transport: {
          primary: marineOverall === "normal" ? "Hôm nay chưa thấy gián đoạn lớn" : marineOverall === "watch" ? "Có dịch vụ cần xem lại" : "Chưa có đủ thông tin",
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
          primary: marine ? stateText(canoState) : "Chưa có thông tin mới",
          status: !marine ? "unknown" : canoState === "RUNNING" || canoState === "DIRECT_CONFIRMED" ? "normal" : canoState === "SUSPENDED" || canoState === "FIELD_REQUIRED" ? "watch" : "unknown",
          source_class: "MIXED"
        },
        airport: {
          label: "Sân bay",
          primary: !airportAvailable ? "Chưa có cập nhật đủ mới" : delayed.length ? delayed.length + " chuyến cần xem" : "Chưa thấy bất thường",
          context: airportAvailable ? total + " chuyến hôm nay" : airportLoaded ? "Chưa có tin mới" : "Chưa xem được sân bay lúc này",
          status: !airportAvailable ? "unknown" : delayed.length ? "watch" : "normal",
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
