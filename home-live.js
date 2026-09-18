(() => {
  const SRC = {
    ground: 'https://raw.githubusercontent.com/kenzuko/Jotrip-Lab/data-weather/data/weather-groundtruth/latest.json',
    local: 'https://raw.githubusercontent.com/kenzuko/Jotrip-Lab/data-weather/data/weather-groundtruth/local-now.json',
    nowcast: 'https://raw.githubusercontent.com/kenzuko/Jotrip-Lab/data-weather/data/weather-nowcast/latest.json',
    marineOps: 'https://raw.githubusercontent.com/kenzuko/Jotrip-Lab/data-marine-ops/data/marine_ops/latest.json',
    airport: 'https://jotrip-airport-live.kenzuko.workers.dev',
    airportFallback: 'https://raw.githubusercontent.com/kenzuko/Jotrip-Lab/data-sunairport/data/sunairport/latest.json'
  };

  const $ = s => document.querySelector(s);
  const fmt = (n, d = 1) => Number.isFinite(Number(n)) ? Number(n).toFixed(d) : '--';
  const stateText = s => ({
    DIRECT_CONFIRMED: 'Đã xác nhận',
    FIELD_REQUIRED: 'Cần xác nhận',
    UNKNOWN: 'Chưa rõ'
  }[s] || 'Chưa rõ');

  async function getJson(url) {
    const r = await fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  }

  async function getAirport() {
    try {
      const r = await fetch(SRC.airport + '?t=' + Date.now(), { cache: 'no-store' });
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
    const strong = box.querySelector('strong');
    const small = box.querySelector('small');
    if (strong) strong.textContent = primary;
    if (small) small.textContent = secondary;
    box.dataset.state = state || 'info';
  }

  function setHappening(name, title, note, badge, good) {
    const row = document.querySelector('[data-happening="' + name + '"]');
    if (!row) return;
    const h3 = row.querySelector('h3');
    const p = row.querySelector('p');
    const em = row.querySelector('em');
    if (h3) h3.textContent = title;
    if (p) p.textContent = note;
    if (em) {
      em.textContent = badge;
      em.classList.toggle('ok', !!good);
    }
  }

  function sunsetFor(date = new Date(), lat = 10.2172, lon = 103.9593, tz = 7) {
    const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 0));
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
    const mm = Math.round(mins % 60);
    return String(hh).padStart(2, '0') + ':' + String(mm === 60 ? 0 : mm).padStart(2, '0');
  }

  function renderTicker(items) {
    const track = $('#liveTicker');
    if (!track || !items.length) return;
    const one = items.map(x => '<span>' + x[0] + '</span><b>' + x[1] + '</b><i>•</i>').join('');
    track.innerHTML = one + one;
  }

  Promise.allSettled([
    getJson(SRC.ground),
    getJson(SRC.local),
    getJson(SRC.nowcast),
    getJson(SRC.marineOps),
    getAirport()
  ]).then(([g, l, n, m, a]) => {
    const ground = g.status === 'fulfilled' ? g.value : null;
    const local = l.status === 'fulfilled' ? l.value : null;
    const nowcast = n.status === 'fulfilled' ? n.value : null;
    const marine = m.status === 'fulfilled' ? m.value : null;
    const airport = a.status === 'fulfilled' ? a.value : null;

    const vvpq = ground?.atmosphere?.vvpq;
    const weatherPrimary = vvpq?.temperature_c != null ? Math.round(vvpq.temperature_c) + '°' : '--';
    const weatherSecondary = vvpq ? 'Gió ' + Math.round(vvpq.wind_speed_kmh || 0) + ' km/h · VVPQ' : 'Chưa có quan trắc';
    setLive('weather', weatherPrimary, weatherSecondary, vvpq ? 'good' : 'unknown');

    const anThoi = local?.points?.an_thoi;
    setLive('sea',
      anThoi?.wave_hs_m != null ? fmt(anThoi.wave_hs_m) + ' m' : '--',
      anThoi ? 'Nam đảo · Hmax ' + fmt(anThoi.wave_hmax_m) + ' m' : 'Chưa có mô hình biển',
      anThoi ? 'info' : 'unknown'
    );

    const canoState = marine?.categories?.cano?.state;
    setLive('cano',
      stateText(canoState),
      canoState === 'FIELD_REQUIRED' ? 'Chưa có bằng chứng trực tiếp' : 'Nam đảo',
      canoState === 'DIRECT_CONFIRMED' ? 'good' : canoState === 'FIELD_REQUIRED' ? 'watch' : 'unknown'
    );

    const sunset = sunsetFor();
    setLive('sunset', sunset, 'Bờ Tây · tính theo vị trí đảo', 'info');

    const convScores = ['duong_dong', 'an_thoi', 'ganh_dau']
      .map(k => nowcast?.points?.[k]?.convective_signal?.score)
      .filter(Number.isFinite);
    const convMax = convScores.length ? Math.max(...convScores) : null;

    const rainStations = Object.values(ground?.rainfall?.stations || {});
    const maxRain = rainStations.length ? Math.max(...rainStations.map(x => Number(x.accumulation_mm) || 0)) : null;

    let wxTitle = 'Quan trắc thời tiết đang được cập nhật';
    let wxBadge = 'LIVE';
    let wxGood = true;
    if (convMax != null && convMax >= 75) {
      wxTitle = 'Tín hiệu đối lưu vệ tinh đang mạnh';
      wxBadge = 'THEO DÕI';
      wxGood = false;
    } else if (maxRain != null && maxRain > 0) {
      wxTitle = 'Có trạm mưa ghi nhận mưa trên đảo';
      wxBadge = 'CẬP NHẬT';
      wxGood = false;
    }
    setHappening('weather',
      wxTitle,
      vvpq ? 'VVPQ ' + Math.round(vvpq.temperature_c) + '°C · gió ' + Math.round(vvpq.wind_speed_kmh || 0) + ' km/h' : 'Quan trắc chưa sẵn sàng',
      wxBadge,
      wxGood
    );

    const ferryState = marine?.categories?.ferry?.state;
    const fastState = marine?.categories?.fast_boat?.state;
    const marineTitle = ferryState === 'DIRECT_CONFIRMED'
      ? 'Phà có bằng chứng vận hành trực tiếp'
      : 'Vận hành biển đang cần xác nhận thêm';
    const marineNote = 'Cano: ' + stateText(canoState) + ' · Tàu cao tốc: ' + stateText(fastState) + ' · Phà: ' + stateText(ferryState);
    setHappening('marine', marineTitle, marineNote, ferryState === 'DIRECT_CONFIRMED' ? 'XÁC NHẬN' : 'KIỂM TRA', ferryState === 'DIRECT_CONFIRMED');

    const records = airport?.records || [];
    const delayed = records.filter(x => x.status_code === 'DELAYED' || x.status === 'TRỄ' || Number(x.estimated_delay_minutes) > 0);
    const total = airport?.counts?.total ?? records.length;
    setHappening('airport',
      delayed.length ? delayed.length + ' chuyến đang cần theo dõi' : 'Bảng chuyến bay chưa thấy trễ đáng kể',
      total + ' chuyến trong bảng hôm nay · nguồn Sun Airport',
      delayed.length ? 'THEO DÕI' : 'BÌNH THƯỜNG',
      delayed.length === 0
    );

    const ticker = [
      ['THỜI TIẾT', weatherPrimary + (vvpq ? ' · ' + Math.round(vvpq.wind_speed_kmh || 0) + ' km/h' : '')],
      ['BIỂN NAM ĐẢO', anThoi?.wave_hs_m != null ? fmt(anThoi.wave_hs_m) + ' m' : 'CHƯA CÓ'],
      ['CANO', stateText(canoState).toUpperCase()],
      ['SÂN BAY', delayed.length ? delayed.length + ' CHUYẾN CẦN THEO DÕI' : 'BÌNH THƯỜNG'],
      ['PHÀ', stateText(ferryState).toUpperCase()],
      ['HOÀNG HÔN', sunset]
    ];
    renderTicker(ticker);

    window.OPENPQ_HOME = {
      generated_at: new Date().toISOString(),
      live_status: {
        weather: { primary: weatherPrimary, secondary: weatherSecondary, source_class: 'ACTUAL' },
        marine: { primary: stateText(canoState), secondary: marineNote, source_class: 'MIXED' },
        sea: { primary: anThoi?.wave_hs_m != null ? fmt(anThoi.wave_hs_m) + ' m' : '--', source_class: 'MODEL' },
        sunset: { primary: sunset, source_class: 'ASTRONOMICAL' }
      },
      source_health: {
        weather: g.status,
        local_now: l.status,
        nowcast: n.status,
        marine_ops: m.status,
        airport: a.status
      }
    };
  }).catch(() => {
    setLive('weather', '--', 'Không tải được dữ liệu', 'unknown');
  });
})();