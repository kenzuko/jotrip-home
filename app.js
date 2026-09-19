const searchForm = document.querySelector('.search');
const searchInput = document.querySelector('#q');
const menuButton = document.querySelector('.menu-button');
const desktopNav = document.querySelector('.desktop-nav');
const dockSearch = document.querySelector('.dock-search');
const headerSearch = document.querySelector('.header-search');
const toast = document.querySelector('.toast');
const filterChips = document.querySelectorAll('.filter-chips button');
const energyTargets = document.querySelectorAll('.live-strip, .section, .colour-band, .heritage-section');

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
  searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => searchInput.focus(), 350);
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
  stay_area: 'LƯU TRÚ',
  itinerary: 'LỊCH TRÌNH',
  practical: 'CẦN BIẾT',
  culture: 'VĂN HÓA',
  history: 'LỊCH SỬ',
  hotel: 'KHÁCH SẠN',
  access: 'ĐẾN ĐẢO',
  hotel_tier: 'PHÂN KHÚC KHÁCH SẠN',
  stay_guide: 'CHỌN KHU Ở',
  booking_channel: 'ĐẶT PHÒNG',
  meal_plan: 'MEAL PLAN',
  price_reference: 'GIÁ THAM KHẢO',
  island_basic: 'HIỂU ĐẢO',
  live: 'TRỰC TIẾP'
};

function escapeSearchHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function closeSearchResults() {
  if (!searchResults || !searchInput) return;
  searchResults.hidden = true;
  searchResults.innerHTML = '';
  searchInput.setAttribute('aria-expanded', 'false');
}

function renderSearchResults(query) {
  if (!searchResults || !searchInput || !window.OpenPQSearch) return;
  const q = query.trim();
  if (q.length < 2) return closeSearchResults();

  const results = window.OpenPQSearch.search(q, 8);
  if (!results.length) {
    searchResults.innerHTML = '<div class="search-empty"><strong>Chưa tìm thấy</strong><span>Thử tên khu vực, địa điểm, món ăn hoặc tiện ích khác.</span></div>';
  } else {
    searchResults.innerHTML = results.map((item, index) => {
      const type = escapeSearchHtml(searchTypeLabel[item.type] || item.type || 'OPEN PHU QUOC');
      const title = escapeSearchHtml(item.title);
      const route = escapeSearchHtml(item.route || '#');
      return '<a class="search-result" role="option" data-search-index="' + index + '" href="' + route + '">' +
        '<span class="search-result-type">' + type + '</span>' +
        '<strong>' + title + '</strong>' +
        '<span class="search-result-arrow" aria-hidden="true">→</span>' +
      '</a>';
    }).join('');
  }
  searchResults.hidden = false;
  searchInput.setAttribute('aria-expanded', 'true');
}

async function ensureSearch() {
  if (searchReady || !window.OpenPQSearch) return searchReady;
  try {
    await window.OpenPQSearch.load('data/views/search-index.json');
    searchReady = true;
  } catch (error) {
    showToast('Tìm kiếm đang tạm thời chưa tải được dữ liệu.');
  }
  return searchReady;
}

searchInput?.addEventListener('focus', async () => {
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
    showToast(`Bộ lọc demo: ${chip.textContent.trim()}`);
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

const swipeRails = document.querySelectorAll('.must-rail, .heritage-rail');

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

/* Hero slideshow */
const hero = document.querySelector('.hero');
const heroSlides = [...document.querySelectorAll('.hero-slide')];
const heroDots = [...document.querySelectorAll('.hero-dots button')];
const heroPrev = document.querySelector('.hero-prev');
const heroNext = document.querySelector('.hero-next');
const heroCount = document.querySelector('.hero-scene-count');
const heroLabel = document.querySelector('.hero-scene-label');
const heroProgress = document.querySelector('.hero-progress');

let heroIndex = 0;
let heroTimer = null;
let touchStartX = 0;
let touchStartY = 0;
const HERO_DELAY = 4000;

function restartHeroProgress() {
  if (!heroProgress) return;
  heroProgress.classList.remove('is-running');
  void heroProgress.offsetWidth;
  heroProgress.classList.add('is-running');
}

function showHeroSlide(index, userInitiated = false) {
  if (!heroSlides.length) return;
  heroIndex = (index + heroSlides.length) % heroSlides.length;

  heroSlides.forEach((slide, i) => {
    slide.classList.toggle('is-active', i === heroIndex);
  });

  heroDots.forEach((dot, i) => {
    const active = i === heroIndex;
    dot.classList.toggle('is-active', active);
    dot.setAttribute('aria-selected', String(active));
  });

  if (heroCount) {
    heroCount.textContent = `${String(heroIndex + 1).padStart(2, '0')} / ${String(heroSlides.length).padStart(2, '0')}`;
  }

  if (heroLabel) {
    heroLabel.textContent = heroSlides[heroIndex]?.dataset.label || '';
  }

  restartHeroProgress();

  if (userInitiated) {
    restartHeroAutoplay();
  }
}

function stopHeroAutoplay() {
  clearInterval(heroTimer);
  heroTimer = null;
}

function startHeroAutoplay() {
  if (heroSlides.length < 2) return;
  stopHeroAutoplay();
  heroTimer = setTimeout(() => {
    showHeroSlide(heroIndex + 1);
    startHeroAutoplay();
  }, HERO_DELAY);
}

function restartHeroAutoplay() {
  startHeroAutoplay();
}

heroPrev?.addEventListener('click', () => showHeroSlide(heroIndex - 1, true));
heroNext?.addEventListener('click', () => showHeroSlide(heroIndex + 1, true));

heroDots.forEach((dot, index) => {
  dot.addEventListener('click', () => showHeroSlide(index, true));
});

hero?.addEventListener('touchstart', (event) => {
  const touch = event.changedTouches?.[0];
  if (!touch) return;
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
}, { passive: true });

hero?.addEventListener('touchend', (event) => {
  const touch = event.changedTouches?.[0];
  if (!touch) return;
  const dx = touch.clientX - touchStartX;
  const dy = touch.clientY - touchStartY;
  if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy)) return;
  showHeroSlide(heroIndex + (dx < 0 ? 1 : -1), true);
}, { passive: true });

const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
if (canHover) {
  hero?.addEventListener('mouseenter', stopHeroAutoplay);
  hero?.addEventListener('mouseleave', startHeroAutoplay);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopHeroAutoplay();
  else startHeroAutoplay();
});

showHeroSlide(0);
startHeroAutoplay();

/* One-time swipe affordance for mobile discovery rails */
const discoveryRails = document.querySelectorAll('.must-rail, .heritage-rail, .area-scroll, .food-picks, .essential-grid');

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
