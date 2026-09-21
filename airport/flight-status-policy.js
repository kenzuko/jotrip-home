(() => {
  const STALE_AFTER_MIN = 20;

  function hm(value) {
    if (!value) return null;
    const m = String(value).match(/(\d{1,2}):(\d{2})/);
    if (m) return `${String(+m[1]).padStart(2,'0')}:${m[2]}`;
    const compact = String(value).match(/^(\d{2})(\d{2})$/);
    return compact ? `${compact[1]}:${compact[2]}` : null;
  }

  function toMin(value) {
    const t = hm(value);
    if (!t) return null;
    const [h,m] = t.split(':').map(Number);
    return h * 60 + m;
  }

  function signedDiff(from, to) {
    const a = toMin(from), b = toMin(to);
    if (a == null || b == null) return null;
    let d = b - a;
    if (d > 720) d -= 1440;
    if (d < -720) d += 1440;
    return d;
  }

  function positiveDiff(from, to) {
    const d = signedDiff(from, to);
    return d == null ? null : Math.max(0, d);
  }

  function fold(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').toUpperCase();
  }

  function vnNow() {
    const p = new Intl.DateTimeFormat('en-CA', {
      timeZone:'Asia/Ho_Chi_Minh', year:'numeric', month:'2-digit', day:'2-digit',
      hour:'2-digit', minute:'2-digit', hour12:false
    }).formatToParts(new Date());
    const o = {};
    p.forEach(x => o[x.type] = x.value);
    return { date:`${o.year}-${o.month}-${o.day}`, minutes:+o.hour*60 + +o.minute };
  }

  function isOperationalStatus(code, raw) {
    const c = String(code || '').toUpperCase();
    const u = fold(raw);
    return ['CHECKIN_SCHEDULED','CHECKIN_OPEN','CHECKIN_CLOSED','BOARDING'].includes(c) ||
      /LAM THU TUC|CHECK.?IN|BOARDING|LEN TAU BAY|QUAY THU TUC DA DONG|CUA KHOI HANH DA DONG/.test(u);
  }

  function isStale(date, scheduled, estimated) {
    const now = vnNow();
    if (date && date < now.date) return true;
    if (date && date > now.date) return false;
    const ref = toMin(estimated || scheduled);
    if (ref == null) return false;
    let d = now.minutes - ref;
    if (d < -720) d += 1440;
    return d > STALE_AFTER_MIN;
  }

  function terminalLabel(direction, actual, delay) {
    const verb = direction === 'arrival' ? 'Đã hạ cánh' : 'Đã cất cánh';
    if (delay != null && delay > 15) return `${verb} ${actual} · trễ ${delay} phút`;
    if (delay != null && delay <= -10) return `${verb} ${actual} · sớm ${Math.abs(delay)} phút`;
    return `${verb} ${actual}`;
  }

  // LIVE page policy - actual outcome always wins over operational text.
  if (typeof displayStatusLabel === 'function') {
    displayStatusLabel = function(r) {
      if (!r) return 'CHƯA RÕ';
      const code = String(r.status_code || '').toUpperCase();
      const raw = r.status || r.raw_status || '';
      const actual = hm(r.actual_time);
      const scheduled = scheduledTime(r);
      const expected = expectedTime(r);
      const actualDelay = Number.isFinite(Number(r.actual_delay_minutes))
        ? Number(r.actual_delay_minutes)
        : (actual ? signedDiff(scheduled, actual) : null);

      if (code === 'CANCELLED' || /HỦY|CANCEL/.test(fold(raw))) return 'Hủy';
      if (actual) return terminalLabel(r.direction, actual, actualDelay);

      const expectedDelta = expected ? signedDiff(scheduled, expected) : null;
      if (expectedDelta != null && expectedDelta <= -10) return `Dự kiến sớm ${Math.abs(expectedDelta)} phút`;
      if (isDelayed(r)) return delayStatusLabel(r);

      if (r.direction === 'arrival' && code === 'DEPARTED') {
        return isStale(null, scheduled, expected) ? 'Chờ giờ hạ cánh' : 'Đang bay đến Phú Quốc';
      }

      if (isOperationalStatus(code, raw) && isStale(null, scheduled, expected)) {
        return r.direction === 'arrival' ? 'Chờ giờ hạ cánh' : 'Chờ giờ cất cánh';
      }

      if (code === 'CHECKIN_SCHEDULED') return r.checkin_time ? `Check-in từ ${r.checkin_time}` : 'Sắp mở check-in';
      if (code === 'CHECKIN_OPEN') return 'Đang check-in';
      if (code === 'CHECKIN_CLOSED') return 'Check-in đã đóng';
      if (code === 'ARRIVED') return 'Đã hạ cánh';
      if (code === 'DEPARTED') return r.direction === 'arrival' ? 'Đang bay đến Phú Quốc' : 'Đã cất cánh';
      if (code === 'BOARDING') return 'Đang lên máy bay';
      if (code === 'ON_TIME') return 'Đúng giờ';
      return raw || 'CHƯA RÕ';
    };

    statusClass = function(label) {
      const s = fold(label);
      if (/HUY|CANCEL/.test(s)) return 'red';
      if (/TRE|DELAY|HOAN|RESCHEDULED|DU KIEN SOM|SOM [0-9]+ PHUT/.test(s)) return 'amber';
      if (/HA CANH|CAT CANH|BAY DEN PHU QUOC/.test(s)) return 'green';
      if (/DUNG GIO|CHECK.?IN|BOARDING|LEN MAY BAY/.test(s)) return 'blue';
      return 'gray';
    };

    try { if (typeof state !== 'undefined' && state.latest && typeof renderAll === 'function') renderAll(); } catch (_) {}
  }

  // HISTORY page policy - use the latest outcome in the archived row, not a stale intermediate state.
  if (typeof humanStatus === 'function') {
    humanStatus = function(r) {
      const raw = sourceStatus(r), u = fold(raw), actual = hm(r.actualTime);
      const scheduled = hm(r.scheduledTime), estimated = hm(r.estimatedTime);
      const actualDelay = actual ? signedDiff(scheduled, actual) : null;

      if (cancelled(r)) return 'Đã hủy';
      if (actual) return terminalLabel(r._direction, actual, actualDelay);

      if (delayed(r)) {
        const d = diff(scheduled, estimated);
        return d > 0 ? `Trễ ${d} phút` : 'Trễ / đổi giờ';
      }

      if (r._direction === 'arrival' && /DA CAT CANH|DEPARTED/.test(u)) {
        return isStale(r._date, scheduled, estimated) ? 'Chưa có giờ hạ cánh' : 'Đang bay đến Phú Quốc';
      }

      if (isOperationalStatus('', raw) && isStale(r._date, scheduled, estimated)) {
        return r._direction === 'arrival' ? 'Chưa có giờ hạ cánh' : 'Chưa có giờ cất cánh';
      }

      const ci = checkinTime(raw);
      if (ci) return `Check-in từ ${ci}`;
      if (u.includes('DANG LAM THU TUC')) return 'Đang check-in';
      if (u.includes('QUAY THU TUC DA DONG')) return 'Check-in đã đóng';
      if (u.includes('CUA KHOI HANH DA DONG')) return 'Cửa khởi hành đã đóng';
      if (u.includes('HANH KHACH DANG LEN TAU BAY') || u.includes('BOARDING')) return 'Đang lên máy bay';
      if (u.includes('DA HA CANH') || u.includes('ARRIVED')) return 'Đã hạ cánh';
      if (u.includes('DA CAT CANH') || u.includes('DEPARTED')) return r._direction === 'arrival' ? 'Đang bay đến Phú Quốc' : 'Đã cất cánh';
      return raw || 'Đúng giờ / chưa ghi nhận trễ';
    };

    statusClass = function(r) {
      if (cancelled(r)) return 'red';
      const actual = hm(r.actualTime);
      if (actual) {
        const d = signedDiff(hm(r.scheduledTime), actual);
        return d != null && d > 15 ? 'amber' : 'green';
      }
      if (delayed(r)) return 'amber';
      const s = fold(humanStatus(r));
      if (/HA CANH|CAT CANH|BAY DEN PHU QUOC/.test(s)) return 'green';
      if (/CHECK.?IN|BOARDING|LEN MAY BAY/.test(s)) return 'blue';
      return '';
    };

    try { if (typeof state !== 'undefined' && state.days && state.days.length && typeof render === 'function') render(); } catch (_) {}
  }
})();
