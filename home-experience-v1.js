(() => {
  "use strict";

  const $ = s => document.querySelector(s);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[ch]));

  function vnClock() {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone:"Asia/Ho_Chi_Minh",hour:"2-digit",minute:"2-digit",hour12:false
    }).formatToParts(new Date());
    const hour = Number(parts.find(x => x.type === "hour")?.value || 0);
    const minute = Number(parts.find(x => x.type === "minute")?.value || 0);
    return { hour, minute, total:hour * 60 + minute };
  }

  function minutes(label) {
    const m = String(label || "").match(/^(\d{1,2}):(\d{2})$/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
  }

  function renderDayLeft() {
    const value = $("#tripClockDaylight");
    const note = $("#tripClockDayNote");
    const sunsetBlock = document.querySelector(".trip-sunset");
    const sunsetLabel = $("#tripClockSunset")?.textContent;
    if (!value || !note) return;
    const now = vnClock();
    const sunset = minutes(sunsetLabel);
    if (!Number.isFinite(sunset)) {
      value.textContent = "Còn nhiều lựa chọn";
      note.textContent = "Xem danh sách bên cạnh để chọn việc hợp với giờ này.";
      return;
    }
    const remain = sunset - now.total;
    const sunsetWeather = window.OPENPQ_HOME?.signals?.sunset_weather || null;
    const sunsetWeatherLevel = sunsetWeather?.level || "unknown";
    if (sunsetBlock) sunsetBlock.hidden = remain <= 0;
    if (remain > 120) {
      const h = Math.floor(remain / 60), m = remain % 60;
      value.textContent = "Còn " + h + (m >= 15 ? " giờ " + m + " phút" : " giờ") + " tới hoàng hôn";
      if (sunsetWeatherLevel === "bad") {
        note.textContent = "Bờ Tây có tín hiệu mưa hoặc dông gần giờ hoàng hôn. Quan sát thêm dự báo trước khi di chuyển.";
      } else if (sunsetWeatherLevel === "watch") {
        note.textContent = "Cuối chiều có thể có mưa cục bộ ở bờ Tây. Quan sát thêm dự báo trước khi di chuyển.";
      } else {
        note.textContent = "Hoàng hôn bờ Tây phụ thuộc mưa và mây chiều nay. Quan sát thêm dự báo trước khi di chuyển.";
      }
    } else if (remain > 0) {
      value.textContent = "Còn khoảng " + remain + " phút tới hoàng hôn";
      if (sunsetWeatherLevel === "bad") {
        note.textContent = "Bờ Tây có tín hiệu mưa hoặc dông gần giờ hoàng hôn. Quan sát thêm dự báo trước khi di chuyển.";
      } else if (sunsetWeatherLevel === "watch") {
        note.textContent = "Có thể có mưa cục bộ ở bờ Tây. Quan sát thêm dự báo trước khi di chuyển.";
      } else {
        note.textContent = "Hoàng hôn bờ Tây phụ thuộc mưa và mây chiều nay. Quan sát thêm dự báo trước khi di chuyển.";
      }
    } else if (now.total < 21 * 60) {
      value.textContent = "Đã sang nhịp buổi tối";
      note.textContent = "Chợ đêm, show theo giờ và một bữa tối thong thả sẽ hợp hơn chạy thêm điểm xa.";
    } else if (now.total < 23 * 60) {
      value.textContent = "Giờ này hợp lịch nhẹ hơn";
      note.textContent = "Ăn tối, chợ đêm hoặc đi bộ gần sẽ hợp hơn cố thêm một điểm xa.";
    } else {
      value.textContent = "Ngày hôm nay gần khép lại";
      note.textContent = "Giữ phần còn lại nhẹ nhàng, hoặc xem trước lịch cho ngày mai.";
    }
  }

  function stableShuffle(rows, key) {
    const ids = rows.map(x => x.id);
    let order = [];
    try { order = JSON.parse(sessionStorage.getItem(key) || "[]"); } catch {}
    if (!Array.isArray(order) || order.length !== ids.length || order.some(id => !ids.includes(id))) {
      order = [...ids];
      for (let i = order.length - 1; i > 0; i--) {
        const seed = (Date.now() + i * 7919) % (i + 1);
        [order[i], order[seed]] = [order[seed], order[i]];
      }
      try { sessionStorage.setItem(key, JSON.stringify(order)); } catch {}
    }
    const byId = new Map(rows.map(x => [x.id, x]));
    return order.map(id => byId.get(id)).filter(Boolean);
  }

  function mealPlan(dishes) {
    const { total } = vnClock();
    let ids, label, key;
    if (total < 10 * 60 + 30) {
      ids = ["bun-quay","bun-ken","goi-ca-trich"];
      label = "Buổi sáng - ưu tiên món nóng, dễ bắt đầu ngày";
      key = "morning";
    } else if (total < 14 * 60) {
      ids = ["bun-quay","goi-ca-trich","bun-ken"];
      label = "Buổi trưa - thử một món địa phương vừa đủ no";
      key = "lunch";
    } else if (total < 17 * 60) {
      ids = ["goi-ca-trich","bun-quay","bun-ken"];
      label = "Buổi chiều - chọn món nhẹ hơn trước khi đi tiếp";
      key = "afternoon";
    } else {
      ids = ["goi-ca-trich","nhum","coi-bien-mai","bun-quay"];
      label = "Buổi tối - món địa phương và hải sản hợp nhịp hơn";
      key = "evening";
    }
    const byId = new Map(dishes.map(x => [x.id, x]));
    const rows = ids.map(id => byId.get(id)).filter(Boolean);
    return { rows:stableShuffle(rows,"openpq.food-now."+key), label };
  }

  async function renderFoodNow() {
    const host = $("#foodNowGrid"), context = $("#foodNowContext");
    if (!host) return;
    try {
      const r = await fetch("data/food.json?t=" + Date.now(), { cache:"no-store" });
      if (!r.ok) throw new Error(String(r.status));
      const data = await r.json();
      const plan = mealPlan(data.dishes || []);
      if (context) context.textContent = plan.label;
      if (!plan.rows.length) throw new Error("empty");
      host.innerHTML = plan.rows.slice(0,3).map(x => {
        const safety = (x.allergen_flags || []).slice(0,2).map(a => a.label).join(" · ");
        return '<a class="food-now-card" href="food/article.html?id='+encodeURIComponent(x.id)+'">'+
          '<span>'+(x.category === "seafood" ? "HẢI SẢN" : "MÓN ĐỊA PHƯƠNG")+'</span>'+
          '<strong>'+esc(x.name)+'</strong>'+
          '<p>'+esc(x.intro || "")+'</p>'+
          (safety ? '<small>Có thể cần lưu ý: '+esc(safety)+'</small>' : '')+
          '<b>Xem món →</b>'+
        '</a>';
      }).join("");
    } catch {
      host.innerHTML = '<div class="surface-loading">Chưa mở được gợi ý món lúc này. <a href="food/">Xem ẩm thực Phú Quốc →</a></div>';
    }
  }

  async function renderIslandStories() {
    const host = $("#islandStoryGrid");
    if (!host) return;
    try {
      const r = await fetch("data/content.json?t=" + Date.now(), { cache:"no-store" });
      if (!r.ok) throw new Error(String(r.status));
      const data = await r.json();
      const stories = data.stories || [];
      const wanted = ["mot-nam-trong-nha-thung","mui-cay-cua-dat-do","nhung-doi-mat-tren-mui-ghe"];
      const byId = new Map(stories.map(x => [x.id, x]));
      const rows = wanted.map(id => byId.get(id)).filter(Boolean);
      if (!rows.length) throw new Error("empty");
      host.innerHTML = rows.map((x,index) =>
        '<a class="island-story-card '+(index === 0 ? "lead" : "")+'" href="stories/article.html?id='+encodeURIComponent(x.id)+'">'+
          '<figure><img src="'+esc(x.image || "assets/hero-local.svg")+'" alt="'+esc(x.title || "Câu chuyện Phú Quốc")+'" loading="lazy" decoding="async"></figure>'+
          '<div><span>'+esc(x.category || "CÂU CHUYỆN PHÚ QUỐC")+'</span>'+
          '<strong>'+esc(x.title)+'</strong>'+
          '<p>'+esc(x.dek || "")+'</p>'+
          '<small>'+(x.read_minutes ? esc(x.read_minutes)+" phút đọc · " : "")+'Đọc câu chuyện →</small></div>'+
        '</a>'
      ).join("");
    } catch {
      host.innerHTML = '<div class="surface-loading">Những câu chuyện của đảo đang được mở lại. <a href="stories/">Vào mục Câu chuyện →</a></div>';
    }
  }

  renderDayLeft();
  setTimeout(renderDayLeft, 500);
  window.addEventListener("openpq:live-ready", renderDayLeft);
  setInterval(renderDayLeft, 60000);
  renderFoodNow();
  renderIslandStories();
})();