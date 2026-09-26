const searchForm = document.querySelector('.search');
const searchInput = document.querySelector('#q');
const menuButton = document.querySelector('.menu-button');
const desktopNav = document.querySelector('.desktop-nav');
const dockSearch = document.querySelector('.dock-search');
const headerSearch = document.querySelector('.header-search');
const toast = document.querySelector('.toast');
const filterChips = document.querySelectorAll('.filter-chips button');
const energyTargets = document.querySelectorAll('.live-strip, .section');

let toastTimer;

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2300);
}

function focusSearch() {
  if (!searchInput) return;
  // Delayed programmatic focus may be rejected by iOS Facebook's browser.
  if (window.matchMedia("(max-width:760px)").matches) {
    searchInput.focus({preventScroll:true});
    activateMobileSearch();
  } else {
    searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => searchInput.focus(), 350);
  }
}

if (window.location.hash === '#q') {
  window.addEventListener('load', () => setTimeout(focusSearch, 100), { once: true });
}

const searchResults = document.querySelector('#searchResults');
let searchReady = false;
let searchDebounce = null;

const searchTypeLabel = {
  zone: 'KHU VỰC',
  place: 'ĐỊA ĐIỂM',
  activity: 'TRẢI NGHIỆM',
  food: 'ĂN UỐNG',
  utility: 'TIỆN ÍCH',
  currency: 'TỶ GIÁ',
  stay_area: 'LƯU TRÚ',
  itinerary: 'LỊCH TRÌNH',
  practical: 'CẦN BIẾT',
  culture: 'VĂN HÓA',
  history: 'LỊCH SỬ',
  hotel: 'KHÁCH SẠN',
  access: 'ĐẾN ĐẢO',
  hotel_tier: 'NHÓM KHÁCH SẠN',
  stay_guide: 'CHỌN KHU Ở',
  booking_channel: 'ĐẶT PHÒNG',
  meal_plan: 'GÓI ĂN KÈM',
  price_reference: 'GIÁ THAM KHẢO',
  island_basic: 'HIỂU ĐẢO',
  live: 'LÚC NÀY',
  story: 'CÂU CHUYỆN',
  lore: 'TÒ MÒ / HUYỀN TÍCH'
};

function escapeSearchHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function closeSearchResults({keepFocus=false}={}) {
  if (!searchResults || !searchInput) return;
  searchResults.hidden = true;
  searchResults.innerHTML = '';
  searchInput.setAttribute('aria-expanded', 'false');
  if (!keepFocus) {
    document.querySelector(".hero")?.classList.remove("search-focused");
    searchResults.style.removeProperty("max-height");
    if (document.activeElement===searchInput) searchInput.blur();
  }
}
// Anchor the suggestions BELOW the input. A fixed bottom-76px panel is
// clipped/overlaps the field when iOS or Facebook's in-app keyboard opens.
function syncMobileSearch(allowScroll=true) {
  if (!window.matchMedia("(max-width:760px)").matches ||
      !document.querySelector(".hero")?.classList.contains("search-focused")) return;
  const v=window.visualViewport;
  const top=v?.offsetTop||0;
  const bottom=top+(v?.height||window.innerHeight);
  const rect=searchForm.getBoundingClientRect();
  const idealTop=top+Math.min(80,Math.max(12,(bottom-top)*.22));
  const remaining=bottom-rect.bottom-10;
  if (allowScroll&&(rect.top<top+8||remaining<105)) {
    window.scrollBy({top:rect.top-idealTop,behavior:"auto"});
    requestAnimationFrame(()=>syncMobileSearch(false));
    return;
  }
  const free=Math.max(64,bottom-searchForm.getBoundingClientRect().bottom-12);
  searchResults.style.maxHeight=Math.min(300,free)+"px";
}
function activateMobileSearch() {
  if (!window.matchMedia("(max-width:760px)").matches) return;
  document.querySelector(".hero")?.classList.add("search-focused");
  requestAnimationFrame(()=>syncMobileSearch());
}
window.visualViewport?.addEventListener("resize",()=>syncMobileSearch());
window.visualViewport?.addEventListener("scroll",()=>syncMobileSearch(false));
window.addEventListener("resize",()=>syncMobileSearch(false));

function renderSearchResults(query) {
  if (!searchResults || !searchInput || !window.OpenPQSearch) return;
  const q = query.trim();
  if (q.length < 2) return closeSearchResults({keepFocus:true});

  const groups = window.OpenPQSearch.searchGrouped ? window.OpenPQSearch.searchGrouped(q, 10) : [{id:'related',label:'Kết quả',items:window.OpenPQSearch.search(q, 8)}];
  const results = groups.flatMap(group => group.items);
  if (!results.length) {
    searchResults.innerHTML = '<div class="search-empty"><strong>Chưa tìm thấy</strong><span>Thử tên khu vực, địa điểm, món ăn hoặc tiện ích khác.</span></div>';
  } else {
    let index = 0;
    searchResults.innerHTML = groups.map(group => '<section class="search-group" data-search-group="' + escapeSearchHtml(group.id) + '">' +
      '<div class="search-group-title">' + escapeSearchHtml(group.label) + '</div>' +
      group.items.map(item => {
        const type = escapeSearchHtml(searchTypeLabel[item.type] || item.type || 'OPEN PHU QUOC');
        const title = escapeSearchHtml(item.title);
        const route = escapeSearchHtml(item.route || '#');
        return '<a class="search-result" role="option" data-search-index="' + index++ + '" href="' + route + '">' +
          '<span class="search-result-type">' + type + '</span>' +
          '<strong>' + title + '</strong>' +
          '<span class="search-result-arrow" aria-hidden="true">→</span>' +
        '</a>';
      }).join('') + '</section>').join('');
  }
  searchResults.hidden = false;
  searchInput.setAttribute('aria-expanded', 'true');
  activateMobileSearch();
  requestAnimationFrame(()=>syncMobileSearch(false));
}

async function ensureSearch() {
  if (searchReady || !window.OpenPQSearch) return searchReady;
  try {
    await window.OpenPQSearch.load('data/views/search-index.json');
    searchReady = true;
  } catch (error) {
    showToast('Tìm kiếm đang tạm gián đoạn. Thử lại sau một chút.');
  }
  return searchReady;
}

searchInput?.addEventListener('focus', async () => {
  activateMobileSearch();
  await ensureSearch();
  if (searchInput.value.trim().length >= 2) renderSearchResults(searchInput.value);
});

searchInput?.addEventListener('input', () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(async () => {
    if (await ensureSearch()) renderSearchResults(searchInput.value);
  }, 100);
});

searchForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const q = searchInput?.value.trim();
  if (!q) return focusSearch();
  if (!(await ensureSearch())) return;
  renderSearchResults(q);
});

document.addEventListener('click', (event) => {
  if (!event.target.closest('.search-shell') && !event.target.closest('.header-search')) closeSearchResults();
});

dockSearch?.addEventListener('click', focusSearch);
headerSearch?.addEventListener('click', focusSearch);
searchInput?.addEventListener('keydown',event=>{if(event.key==='Escape')closeSearchResults();});

const moreSheet = document.querySelector('#more-sheet');
const moreBackdrop = document.querySelector('.more-backdrop');
const moreClose = document.querySelector('.more-close');
const moreButton = document.querySelector('.dock-more');

function openMoreSheet() {
  if (!moreSheet || !moreBackdrop) return;
  moreSheet.hidden = false;
  moreBackdrop.hidden = false;
  requestAnimationFrame(() => {
    moreSheet.classList.add('is-open');
    moreBackdrop.classList.add('is-open');
  });
  document.body.classList.add('sheet-open');
  menuButton?.setAttribute('aria-expanded', 'true');
  menuButton?.setAttribute('aria-label', 'Đóng menu');
  setActiveMobileTab?.('more');
}

function closeMoreSheet() {
  if (!moreSheet || !moreBackdrop) return;
  moreSheet.classList.remove('is-open');
  moreBackdrop.classList.remove('is-open');
  document.body.classList.remove('sheet-open');
  menuButton?.setAttribute('aria-expanded', 'false');
  menuButton?.setAttribute('aria-label', 'Mở menu');
  setTimeout(() => {
    moreSheet.hidden = true;
    moreBackdrop.hidden = true;
  }, 340);
}

menuButton?.addEventListener('click', () => {
  if (moreSheet?.classList.contains('is-open')) closeMoreSheet();
  else openMoreSheet();
});

moreButton?.addEventListener('click', openMoreSheet);
moreClose?.addEventListener('click', closeMoreSheet);
moreBackdrop?.addEventListener('click', closeMoreSheet);
moreSheet?.addEventListener('click', (event) => {
  if (event.target.closest('a')) closeMoreSheet();
});

desktopNav?.addEventListener('click', (event) => {
  if (!(event.target instanceof HTMLAnchorElement)) return;
  desktopNav.classList.remove('open');
});

filterChips.forEach((chip) => {
  chip.addEventListener('click', () => {
    filterChips.forEach((item) => item.classList.remove('active'));
    chip.classList.add('active');
    showToast(`Đang xem: ${chip.textContent.trim()}`);
  });
});

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
document.body.classList.add('motion-on');
if (prefersReducedMotion) document.body.classList.add('motion-reduced');

if ('IntersectionObserver' in window) {
  document.body.classList.add('motion-ready');
  energyTargets.forEach((target) => target.classList.add('energy-target'));

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in-view');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.08, rootMargin: '80px 0px -30px' });

  requestAnimationFrame(() => {
    energyTargets.forEach((target) => observer.observe(target));
  });
} else {
  energyTargets.forEach((target) => target.classList.add('in-view'));
}

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  desktopNav?.classList.remove('open');
  closeMoreSheet();
  closeSearchResults();
});

const swipeRails = document.querySelectorAll('.activity-board-grid, .curiosity-rail');

function updateRailActive(rail) {
  const cards = [...rail.children];
  if (!cards.length) return;

  const center = rail.scrollLeft + rail.clientWidth / 2;
  let active = cards[0];
  let best = Infinity;

  cards.forEach((card) => {
    const cardCenter = card.offsetLeft + card.offsetWidth / 2;
    const distance = Math.abs(center - cardCenter);
    if (distance < best) {
      best = distance;
      active = card;
    }
  });

  cards.forEach((card) => card.classList.toggle('is-active', card === active));
}

swipeRails.forEach((rail) => {
  let ticking = false;

  const refresh = () => {
    ticking = false;
    updateRailActive(rail);
  };

  updateRailActive(rail);

  rail.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(refresh);
  }, { passive: true });

  window.addEventListener('resize', refresh, { passive: true });
});

/* Hero slideshow: the scene order is editorial, chosen once per visit.
   Keep the approved four-frame slideshow and visitor-operated controls. */
const hero = document.querySelector('.hero');
const heroSlides = [...document.querySelectorAll('.hero-slide')];
const heroDots = [...document.querySelectorAll('.hero-dots button')];
const heroPrev = document.querySelector('.hero-prev');
const heroNext = document.querySelector('.hero-next');
const heroCount = document.querySelector('.hero-scene-count');
const heroLabel = document.querySelector('.hero-scene-label');
const heroProgress = document.querySelector('.hero-progress');

const HERO_SCENES = {
  fishSauce: {
    src:"https://commons.wikimedia.org/wiki/Special:Redirect/file/Vats%20at%20a%20Fish%20Sauce%20Factory%20on%20Phu%20Quoc%20Island%20in%20Vietnam%2001.jpg?width=1800",
    alt:"Những thùng gỗ ủ nước mắm truyền thống ở Phú Quốc",label:"MỘT NĂM TRONG NHÀ THÙNG"
  },
  sunsetTown: {
    src:"https://commons.wikimedia.org/wiki/Special:Redirect/file/An%20Thoi%20fishing%20harbour%20Sunset%20Town%20Sun%20World%20Phu%20Quoc%20Vietnam.jpg?width=2000",
    alt:"An Thới và Sunset Town lúc hoàng hôn",label:"AN THỚI LÊN ĐÈN"
  },
  pepper: {
    src:"https://commons.wikimedia.org/wiki/Special:Redirect/file/Pfefferanbau%20auf%20Phu%20Quoc.jpg?width=1600",
    alt:"Vườn tiêu Phú Quốc",label:"MÙI CAY CỦA ĐẤT ĐỎ"
  },
  harbor: {
    src:"https://commons.wikimedia.org/wiki/Special:Redirect/file/Boats%20PhuQuoc.jpg?width=1800",
    alt:"Ghe tàu ven biển Phú Quốc",label:"NHỊP SỐNG VEN BIỂN"
  },
  islands: {
    src:"/assets/photos/tour-3-islands-jotrip-1600.jpg",
    alt:"Một chuyến khám phá các đảo nhỏ phía Nam Phú Quốc",label:"MỘT NGÀY NGOÀI ĐẢO"
  },
  saoBeach: {
    src:"https://commons.wikimedia.org/wiki/Special:Redirect/file/Bai%20Sao%2C%20Ph%C3%BA%20Qu%E1%BB%91c%2C%20Vietnam%20%283870300491%29.jpg?width=1800",
    alt:"Biển Bãi Sao, Phú Quốc",label:"BIỂN XANH BÃI SAO"
  },
  goldenHour: {
    src:"/assets/media/jotrip-big-game-fishing-golden-hour-2025.jpg",
    alt:"Chuyến câu cá lớn trong ánh chiều trên biển Phú Quốc",label:"ÁNH CHIỀU NGOÀI KHƠI"
  },
  nightMarket: {
    src:"https://commons.wikimedia.org/wiki/Special:Redirect/file/Making%20ice%20cream%20rolls%20in%20Phu%20Quoc%20night%20market%20Vietnam.jpg?width=1800",
    alt:"Quầy kem cuộn ở chợ đêm Phú Quốc",label:"CHỢ ĐÊM LÊN ĐÈN"
  },
  nightFishing: {
    src:"/assets/media/jotrip-night-fishing-2025.jpg",
    alt:"Trải nghiệm câu cá buổi tối ở Phú Quốc",label:"CHUYỆN KỂ ĐÊM TRÊN BIỂN"
  },
  seafood: {
    src:"/assets/media/jotrip-grilled-squid-2025.jpg",
    alt:"Món mực nướng Phú Quốc",label:"HƯƠNG VỊ CỦA ĐẢO"
  }
};
const HERO_MOODS = {
  morning:["harbor","pepper","islands","fishSauce"],
  day:["islands","saoBeach","pepper","fishSauce"],
  sunset:["sunsetTown","goldenHour","harbor","fishSauce"],
  night:["nightMarket","nightFishing","seafood","sunsetTown"],
  cloudy:["fishSauce","pepper","harbor","seafood"],
  rainy:["fishSauce","seafood","pepper","nightMarket"],
  "rainy-night":["nightMarket","seafood","fishSauce","pepper"]
};
const HERO_FALLBACK="/assets/photos/tour-3-islands-jotrip-1600.jpg";
const HERO_DELAY = 4000;
const heroStartedAt=Date.now();
let heroIndex=0,heroTimer=null,touchStartX=0,touchStartY=0;
let currentMood="day",pendingMood=null,weatherSelectionApplied=false;

function useHeroMood(mood){
  const keys=HERO_MOODS[mood]||HERO_MOODS.day;
  currentMood=mood;
  hero?.setAttribute("data-hero-mood",mood);
  heroSlides.forEach((slide,i)=>{
    const scene=HERO_SCENES[keys[i]];
    if(!scene)return;
    slide.dataset.label=scene.label;
    const photo=slide.querySelector("img");
    if(!photo)return;
    photo.alt=scene.alt;
    photo.loading=i===0?"eager":"lazy";
    photo.decoding="async";
    photo.fetchPriority=i===0?"high":"low";
    photo.onerror=()=>{photo.onerror=null;photo.src=HERO_FALLBACK;};
    if(photo.getAttribute("src")!==scene.src)photo.src=scene.src;
  });
}
useHeroMood(window.OpenPQHeroContext?.select(new Date(),window.OPENPQ_HOME)?.mood||"day");
window.addEventListener("openpq:live-ready",event=>{
  // Apply one fresh-weather correction in the initial hydration period only.
  // Do not change the photos every time a live component refreshes.
  if(weatherSelectionApplied||Date.now()-heroStartedAt>25000)return;
  const chosen=window.OpenPQHeroContext?.select(new Date(),event.detail);
  if(!chosen?.weatherUsed)return;
  weatherSelectionApplied=true;
  if(chosen.mood!==currentMood)pendingMood=chosen.mood;
});

function restartHeroProgress(){
  if(!heroProgress)return;
  heroProgress.classList.remove("is-running");
  void heroProgress.offsetWidth;
  heroProgress.classList.add("is-running");
}
function showHeroSlide(index,userInitiated=false){
  if(!heroSlides.length)return;
  const next=(index+heroSlides.length)%heroSlides.length;
  // A delayed weather response can only change the gallery at the natural
  // wrap boundary, never while the visitor is looking at a photograph.
  if(next===0&&pendingMood){useHeroMood(pendingMood);pendingMood=null;}
  heroIndex=next;
  heroSlides.forEach((slide,i)=>{
    slide.classList.toggle("is-active",i===heroIndex);
    slide.setAttribute("aria-hidden",String(i!==heroIndex));
  });
  heroDots.forEach((dot,i)=>{
    const active=i===heroIndex;
    dot.classList.toggle("is-active",active);
    dot.setAttribute("aria-selected",String(active));
  });
  if(heroCount)heroCount.textContent=String(heroIndex+1).padStart(2,"0")+" / "+String(heroSlides.length).padStart(2,"0");
  if(heroLabel)heroLabel.textContent=heroSlides[heroIndex]?.dataset.label||"";
  restartHeroProgress();
  if(userInitiated)restartHeroAutoplay();
}
function stopHeroAutoplay(){
  clearTimeout(heroTimer);
  heroTimer=null;
}
function startHeroAutoplay(){
  if(heroSlides.length<2||document.hidden||document.activeElement===searchInput)return;
  stopHeroAutoplay();
  heroTimer=setTimeout(()=>{showHeroSlide(heroIndex+1);startHeroAutoplay();},HERO_DELAY);
}
function restartHeroAutoplay(){startHeroAutoplay();}
heroPrev?.addEventListener("click",()=>showHeroSlide(heroIndex-1,true));
heroNext?.addEventListener("click",()=>showHeroSlide(heroIndex+1,true));
heroDots.forEach((dot,i)=>dot.addEventListener("click",()=>showHeroSlide(i,true)));
hero?.addEventListener("touchstart",event=>{
  const touch=event.changedTouches?.[0];
  if(!touch)return;
  touchStartX=touch.clientX;touchStartY=touch.clientY;
},{passive:true});
hero?.addEventListener("touchend",event=>{
  const touch=event.changedTouches?.[0];
  if(!touch)return;
  const dx=touch.clientX-touchStartX,dy=touch.clientY-touchStartY;
  if(Math.abs(dx)<45||Math.abs(dx)<Math.abs(dy))return;
  showHeroSlide(heroIndex+(dx<0?1:-1),true);
},{passive:true});
const canHover=window.matchMedia("(hover: hover) and (pointer: fine)").matches;
if(canHover){
  hero?.addEventListener("mouseenter",stopHeroAutoplay);
  hero?.addEventListener("mouseleave",startHeroAutoplay);
}
document.addEventListener("visibilitychange",()=>{
  if(document.hidden)stopHeroAutoplay();else startHeroAutoplay();
});
searchInput?.addEventListener("focus",stopHeroAutoplay);
searchInput?.addEventListener("blur",()=>{
  // Clicking a search suggestion still navigates; do not hide it on blur.
  if(!document.hidden)startHeroAutoplay();
});
showHeroSlide(0);
startHeroAutoplay();

/* One-time swipe affordance for mobile discovery rails */
const discoveryRails = document.querySelectorAll('.activity-board-grid, .curiosity-rail, .explore-more-grid');

if ('IntersectionObserver' in window && window.matchMedia('(max-width: 760px)').matches) {
  const peekObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const rail = entry.target;
      rail.classList.add('rail-peek');
      setTimeout(() => {
        const start = rail.scrollLeft;
        rail.scrollTo({ left: start + 72, behavior: 'smooth' });
        setTimeout(() => rail.scrollTo({ left: start, behavior: 'smooth' }), 620);
      }, 260);
      setTimeout(() => rail.classList.remove('rail-peek'), 1350);
      peekObserver.unobserve(rail);
    });
  }, { threshold: 0.38 });

  discoveryRails.forEach((rail) => peekObserver.observe(rail));
}


/* Approved mobile tab behaviour */
const mobileTabs = [...document.querySelectorAll('.mobile-dock [data-tab]')];

function setActiveMobileTab(tabName) {
  mobileTabs.forEach((item) => {
    item.classList.toggle('active', item.dataset.tab === tabName);
  });
}

mobileTabs.forEach((item) => {
  item.addEventListener('click', () => {
    const tab = item.dataset.tab;
    if (tab && tab !== 'search' && tab !== 'more') setActiveMobileTab(tab);
  });
});

dockSearch?.addEventListener('click', () => {
  setActiveMobileTab('search');
  setTimeout(() => setActiveMobileTab('today'), 900);
});
