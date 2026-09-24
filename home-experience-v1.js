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

  // Homepage owns one food suggestion. No additional section or redirect is required.
  const foodNowState = {pool:[], visuals:{}, selected:null};

  function mealPlan(dishes) {
    const hour = vnClock().total;
    const meal = hour < 10 * 60 + 30 ? "breakfast"
      : hour < 14 * 60 ? "lunch"
      : hour < 17 * 60 ? "snack"
      : hour < 23 * 60 ? "dinner" : "breakfast";
    const names = {
      breakfast:"Buổi sáng - chọn một món để bắt đầu ngày",
      lunch:"Buổi trưa - gợi ý một món vừa bữa",
      snack:"Buổi chiều - gợi ý một món ăn nhẹ",
      dinner:"Buổi tối - thử một món địa phương hoặc hải sản"
    };
    let pool = dishes.filter(x => (x.meal_times || []).includes(meal));
    // Some meals have few entries; never show an empty suggestion.
    if (pool.length < 2 && meal === "snack")
      pool = dishes.filter(x => (x.meal_times || []).includes("lunch") || (x.meal_times || []).includes("snack"));
    if (!pool.length) pool = dishes;
    return {pool,label:names[meal]};
  }

  function foodNowPhoto(dish) {
    const pictures = foodNowState.visuals?.food?.[dish.id]?.images || [];
    const picture = pictures.find(img => img?.url && img.hero_eligible !== false);
    if (picture) {
      const caption = picture.scope === "exact_subject"
        ? "Ảnh món" : "Ảnh minh họa";
      return '<figure class="food-now-media">'+
        '<img src="'+esc(picture.url)+'" alt="'+esc(picture.alt || dish.name)+'" loading="lazy" decoding="async" onerror="this.closest(\'figure\').classList.add(\'is-error\')">'+
        '<figcaption>'+esc(caption)+'</figcaption></figure>';
    }
    return '<figure class="food-now-media food-now-media-empty"><span>Ảnh riêng của món đang được bổ sung</span></figure>';
  }

  function renderSelectedFood() {
    const host = $("#foodNowGrid"), dish = foodNowState.selected;
    if (!host || !dish) return;
    const safety = (dish.allergen_flags || []).slice(0,2).map(x => x.label).join(" · ");
    host.innerHTML = '<article class="food-now-card featured-food-card">'+
      foodNowPhoto(dish)+
      '<div class="food-now-copy">'+
        '<span>'+(dish.category === "seafood" ? "HẢI SẢN" : "MÓN ĐỊA PHƯƠNG")+'</span>'+
        '<h3>'+esc(dish.name)+'</h3>'+
        '<p>'+esc(dish.intro || "")+'</p>'+
        (safety ? '<small>Thành phần cần lưu ý: '+esc(safety)+'</small>' : "")+
        '<a href="food/article.html?id='+encodeURIComponent(dish.id)+'">Khám phá món này →</a>'+
      '</div></article>';
    const button = $("#foodRandomBtn");
    if (button) button.disabled = foodNowState.pool.length < 2;
  }

  function chooseRandomFood() {
    const pool = foodNowState.pool;
    if (!pool.length) return;
    const choices = pool.length > 1
      ? pool.filter(x => x.id !== foodNowState.selected?.id)
      : pool;
    foodNowState.selected = choices[Math.floor(Math.random() * choices.length)];
    renderSelectedFood();
  }

  async function renderFoodNow() {
    const host = $("#foodNowGrid"), context = $("#foodNowContext");
    if (!host) return;
    // Load the meal dataset first: a slow visual manifest must never block the card.
    const visualsPromise = fetch("data/visual-context.json?t=" + Date.now(), {cache:"no-store"})
      .then(r => r.ok ? r.json() : {}).catch(() => ({}));
    try {
      const response = await fetch("data/food.json?t=" + Date.now(), {cache:"no-store"});
      if (!response.ok) throw new Error(String(response.status));
      const data = await response.json();
      const plan = mealPlan(data.dishes || []);
      if (!plan.pool.length) throw new Error("no dishes");
      foodNowState.pool = plan.pool;
      if (context) context.textContent = plan.label;
      chooseRandomFood();
      visualsPromise.then(visuals => {
        foodNowState.visuals = visuals || {};
        renderSelectedFood();
      });
    } catch {
      host.innerHTML = '<div class="surface-loading">Chưa mở được gợi ý lúc này. <a href="food/">Xem các món Phú Quốc →</a></div>';
    }
  }

  $("#foodRandomBtn")?.addEventListener("click", chooseRandomFood);

  function sessionStorySlice(stories, count) {
    if (!stories.length) return [];
    const key = "openpq.island-stories.session.v1";
    const byId = new Map(stories.map(x => [x.id, x]));
    let order = [];
    try { order = JSON.parse(sessionStorage.getItem(key) || "[]"); } catch {}
    if (!Array.isArray(order) || order.length !== stories.length || order.some(id => !byId.has(id))) {
      order = stories.map(x => x.id);
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      try { sessionStorage.setItem(key, JSON.stringify(order)); } catch {}
    }
    return order.slice(0, Math.min(count, order.length)).map(id => byId.get(id)).filter(Boolean);
  }

  async function renderIslandStories() {
    const host = $("#islandStoryGrid");
    if (!host) return;
    try {
      const r = await fetch("data/content.json?t=" + Date.now(), { cache:"no-store" });
      if (!r.ok) throw new Error(String(r.status));
      const data = await r.json();
      const stories = data.stories || [];
      const rows = sessionStorySlice(stories, 3);
      if (!rows.length) throw new Error("empty");
      host.innerHTML = rows.map((x,index) =>
        '<a class="island-story-card '+(index === 0 ? "lead" : "")+'" href="stories/article.html?id='+encodeURIComponent(x.id)+'">'+
          '<figure><img src="'+esc(x.image || "assets/hero-local.svg")+'" alt="'+esc(x.image_alt || x.title || "Câu chuyện Phú Quốc")+'" loading="lazy" decoding="async"></figure>'+
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