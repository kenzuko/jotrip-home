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

  function sunsetDayNote(outlook, remain) {
    const level=outlook?.level||"unknown";
    const reason=outlook?.reason||"unknown";

    if (remain > 360) {
      if (level === "bad") {
        if (reason === "forecast_rain") {
          const areas=(Array.isArray(outlook?.forecast_rain_likely_points)&&outlook.forecast_rain_likely_points.length
            ? outlook.forecast_rain_likely_points
            : outlook?.forecast_rain_points||[]).filter(Boolean);
          if (areas.length === 1) return "Dự báo cuối chiều cho thấy khả năng mưa rào rõ hơn quanh " + areas[0] + ". Hệ thống sẽ kiểm tra lại khi gần hoàng hôn.";
          if (areas.length === 2) return "Dự báo cuối chiều cho thấy khả năng mưa rào rõ hơn quanh " + areas.join(" và ") + ". Hệ thống sẽ kiểm tra lại khi gần hoàng hôn.";
          if (areas.length >= 3) return "Dự báo cuối chiều cho thấy khả năng mưa rào rải rác dọc bờ Tây. Hệ thống sẽ kiểm tra lại khi gần hoàng hôn.";
          return "Dự báo cuối chiều có tín hiệu mưa đáng kể ở bờ Tây. Hệ thống sẽ kiểm tra lại khi gần hoàng hôn.";
        }
        return "Cuối chiều có tín hiệu thời tiết cần lưu ý ở bờ Tây. Hệ thống sẽ kiểm tra lại khi gần hoàng hôn.";
      }
      if (level === "watch" && reason === "forecast_rain") {
        const areas=(outlook?.forecast_rain_points||[]).filter(Boolean);
        if (areas.length === 1) return "Cuối chiều có thể có mưa rào cục bộ quanh " + areas[0] + ". Các khu khác của bờ Tây chưa thấy tín hiệu đáng kể.";
        if (areas.length === 2) return "Cuối chiều có thể có mưa rào cục bộ quanh " + areas.join(" và ") + ".";
        if (areas.length >= 3) return "Cuối chiều có thể có mưa rào rải rác ở một số nơi dọc bờ Tây.";
        return "Cuối chiều còn một ít bất định về mưa. Hệ thống sẽ cập nhật lại khi gần hoàng hôn.";
      }
      if (level === "unknown") {
        return "Còn sớm để kết luận về mây lúc hoàng hôn. Hệ thống sẽ cập nhật lại khi dữ liệu chiều rõ hơn.";
      }
      return "Hôm nay nhìn chung khá thuận lợi. Hệ thống sẽ cập nhật lại khi gần hoàng hôn.";
    }

    if (level === "bad") {
      return reason === "observed_weather"
        ? "Quan trắc gần bờ Tây đang ghi nhận thời tiết xấu. Nên xem khu vực cụ thể trước khi đi."
        : "Khả năng mưa quanh giờ hoàng hôn đang cao hơn. Nên xem lại trước khi di chuyển.";
    }

    if (level === "watch") {
      if (reason === "observed_rain") {
        return "Có điểm bờ Tây đang ghi nhận mưa. Tình hình có thể khác nhau giữa các khu vực.";
      }
      if (reason === "horizon_cloud") {
        const areas=Array.isArray(outlook?.horizon_cloud_points)?outlook.horizon_cloud_points.filter(Boolean):[];
        if (areas.length === 1) return "Mây đang dày hơn trên hướng chân trời ở " + areas[0] + ". Mặt trời có thể bị che lúc lặn.";
        if (areas.length > 1) return "Mây đang dày hơn trên hướng chân trời ở " + areas.join(" và ") + ". Một phần bờ Tây có thể bị che lúc mặt trời lặn.";
        return "Ảnh vệ tinh đang thấy mây dày hơn trên hướng chân trời hoàng hôn. Mặt trời có thể bị che lúc lặn.";
      }
      if (reason === "cloud_approaching") {
        return "Mây đối lưu đang có quỹ đạo tiến về bờ Tây. Khả năng thấy mặt trời lặn có thể giảm.";
      }
      if (reason === "low_visibility") {
        return "Tầm nhìn đang giảm. Hoàng hôn có thể kém rõ dù không nhất thiết có mưa.";
      }
      if (reason === "satellite_convection") {
        return "Có mây đối lưu quanh khu vực, nhưng chưa đủ bằng chứng để coi là mưa tại bờ Tây.";
      }
      if (reason === "forecast_rain") {
        const areas=(outlook?.forecast_rain_points||[]).filter(Boolean);
        if (areas.length === 1) return "Dự báo quanh giờ hoàng hôn có thể có mưa rào cục bộ quanh " + areas[0] + ".";
        if (areas.length === 2) return "Dự báo quanh giờ hoàng hôn có thể có mưa rào cục bộ quanh " + areas.join(" và ") + ".";
        if (areas.length >= 3) return "Dự báo quanh giờ hoàng hôn có thể có mưa rào rải rác dọc bờ Tây.";
        return "Dự báo quanh giờ hoàng hôn có tín hiệu mưa cục bộ. Sẽ tiếp tục cập nhật khi gần giờ.";
      }
      return "Cuối chiều còn một ít bất định. Nên xem lại khi gần giờ hoàng hôn.";
    }

    if (level === "good" && reason === "horizon_clear") {
      return "Ảnh vệ tinh hiện cho thấy hướng chân trời hoàng hôn khá ít mây.";
    }
    if (level === "good" && reason === "cloud_passing") {
      return "Có mây đối lưu quanh đảo nhưng quỹ đạo hiện tại đang đi lệch hoặc đi xa bờ Tây.";
    }
    if (level === "good") {
      return remain <= 180
        ? "Hiện chưa thấy tín hiệu thời tiết đáng ngại cho hoàng hôn bờ Tây."
        : "Hôm nay nhìn chung khá thuận lợi. Chưa thấy tín hiệu thời tiết đáng ngại cho cuối chiều.";
    }

    return "Tình hình cuối chiều chưa đủ rõ. Hệ thống sẽ cập nhật lại khi gần hoàng hôn.";
  }

  function renderDayWatch() {
    const host = $("#tripDayWatch");
    if (!host) return;
    const selector = window.OpenPQDayWatch;
    const candidates = window.OPENPQ_HOME?.signals?.day_watch_candidates || [];
    const sunsetWeather = window.OPENPQ_HOME?.signals?.sunset_weather || null;
    const items = selector?.select
      ? selector.select(candidates,{sunsetWeather,maxItems:2})
      : [];
    if (!items.length) {
      host.hidden = true;
      host.innerHTML = "";
      return;
    }
    host.hidden = false;
    host.innerHTML = items.map(item => {
      const body = '<span>'+esc(item.text)+'</span>';
      return item.href
        ? '<a class="trip-day-watch-line" data-level="'+esc(item.level||"watch")+'" href="'+esc(item.href)+'">'+body+'</a>'
        : '<div class="trip-day-watch-line" data-level="'+esc(item.level||"watch")+'">'+body+'</div>';
    }).join("");
  }

  function renderDayLeft() {
    renderDayWatch();
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
    if (sunsetBlock) sunsetBlock.hidden = remain <= 0;

    if (remain > 0) {
      const h = Math.floor(remain / 60), m = remain % 60;
      value.textContent = remain > 120
        ? "Còn " + h + (m >= 15 ? " giờ " + m + " phút" : " giờ") + " tới hoàng hôn"
        : "Còn khoảng " + remain + " phút tới hoàng hôn";
      note.textContent = sunsetDayNote(sunsetWeather, remain);
    } else if (now.total < 21 * 60) {
      value.textContent = "Đã sang nhịp buổi tối";
      note.textContent = "Giờ này có thể ăn tối hoặc ghé chợ đêm gần nơi mình ở. Muốn xem show, hãy kiểm tra thông báo suất diễn tối nay.";
    } else if (now.total < 23 * 60) {
      value.textContent = "Giờ này hợp lịch nhẹ hơn";
      note.textContent = "Ăn tối, chợ đêm hoặc đi bộ gần sẽ hợp hơn cố thêm một điểm xa.";
    } else {
      value.textContent = "Ngày hôm nay gần khép lại";
      note.textContent = "Giữ phần còn lại nhẹ nhàng, hoặc xem trước lịch cho ngày mai.";
    }
  }


  // Three distinct dishes per draw, still inside the existing homepage card.
  const foodNowState = {pool:[], visuals:{}, selected:[]};

  function mealPlan(dishes) {
    const hour = vnClock().total;
    const meal = hour < 10 * 60 + 30 ? "breakfast"
      : hour < 14 * 60 ? "lunch"
      : hour < 17 * 60 ? "snack"
      : hour < 23 * 60 ? "dinner" : "breakfast";
    const names = {
      breakfast:"Ba món cho buổi sáng",
      lunch:"Ba món cho bữa trưa",
      snack:"Chiều nay ăn gì?",
      dinner:"Tối nay chọn món gì?"
    };
    let pool = dishes.filter(x => (x.meal_times || []).includes(meal));
    if (pool.length < 3) pool = dishes.filter(x => (x.meal_times || []).includes(meal) || (x.meal_times || []).includes("snack"));
    if (pool.length < 3) pool = dishes;
    return {pool,label:names[meal]};
  }

  function foodNowPhoto(dish) {
    const pictures = foodNowState.visuals?.food?.[dish.id]?.images || [];
    const picture = pictures.find(img => img?.url && img.hero_eligible !== false);
    if (picture) return '<figure class="food-now-media">'+
      '<img src="'+esc(picture.url)+'" alt="'+esc(picture.alt || dish.name)+'" loading="lazy" decoding="async" data-fallback="'+esc(picture.fallback_url||"")+'" onerror="if(this.dataset.fallback){this.src=this.dataset.fallback;delete this.dataset.fallback}else{this.closest(\'figure\').classList.add(\'is-error\')}"></figure>';
    return '<figure class="food-now-media food-now-media-empty"><span>Ảnh món đang được bổ sung</span></figure>';
  }

  function renderSelectedFood() {
    const host = $("#foodNowGrid");
    if (!host || !foodNowState.selected.length) return;
    host.innerHTML = foodNowState.selected.map(dish => {
      const safety = (dish.allergen_flags || []).slice(0,2).map(x => x.label).join(" · ");
      return '<article class="food-now-card featured-food-card">'+
        foodNowPhoto(dish)+
        '<div class="food-now-copy">'+
          '<span>'+(dish.category === "seafood" ? "HẢI SẢN" : "MÓN ĐỊA PHƯƠNG")+'</span>'+
          '<h3>'+esc(dish.name)+'</h3>'+
          '<p>'+esc(dish.intro || "")+'</p>'+
          (safety ? '<small>Thành phần cần lưu ý: '+esc(safety)+'</small>' : "")+
          '<a href="food/article.html?id='+encodeURIComponent(dish.id)+'">Xem món này →</a>'+
        '</div></article>';
    }).join("");
    const button = $("#foodRandomBtn");
    if (button) button.disabled = foodNowState.pool.length <= 3;
  }

  function chooseRandomFood() {
    const pool = foodNowState.pool;
    if (!pool.length) return;
    const previous = new Set(foodNowState.selected.map(x => x.id));
    let choices = pool.filter(x => !previous.has(x.id));
    const count = Math.min(3,pool.length);
    if (choices.length < count) choices = [...pool];
    choices = [...choices];
    for (let i=choices.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [choices[i],choices[j]]=[choices[j],choices[i]];
    }
    foodNowState.selected=choices.slice(0,count);
    renderSelectedFood();
  }

  async function renderFoodNow() {
    const host = $("#foodNowGrid"), context = $("#foodNowContext");
    if (!host) return;
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
  window.addEventListener("openpq:sunset-updated", renderDayLeft);
  setInterval(renderDayLeft, 60000);
  renderFoodNow();
  renderIslandStories();
})();