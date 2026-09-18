const searchForm = document.querySelector('.search');
const searchInput = document.querySelector('#q');
const menuButton = document.querySelector('.menu-button');
const desktopNav = document.querySelector('.desktop-nav');
const dockSearch = document.querySelector('.dock-search');
const headerSearch = document.querySelector('.header-search');
const toast = document.querySelector('.toast');
const filterChips = document.querySelectorAll('.filter-chips button');
const energyTargets = document.querySelectorAll('.live-strip, .section, .colour-band');

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

searchForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const q = searchInput?.value.trim();
  if (!q) return focusSearch();
  showToast('Tìm kiếm demo - giai đoạn tiếp theo sẽ nối điểm đến, lịch hoạt động, giao thông và dữ liệu trực tiếp.');
});

dockSearch?.addEventListener('click', focusSearch);
headerSearch?.addEventListener('click', focusSearch);

menuButton?.addEventListener('click', () => {
  const open = desktopNav?.classList.toggle('open') ?? false;
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Đóng menu' : 'Mở menu');
});

desktopNav?.addEventListener('click', (event) => {
  if (!(event.target instanceof HTMLAnchorElement)) return;
  desktopNav.classList.remove('open');
  menuButton?.setAttribute('aria-expanded', 'false');
  menuButton?.setAttribute('aria-label', 'Mở menu');
});

filterChips.forEach((chip) => {
  chip.addEventListener('click', () => {
    filterChips.forEach((item) => item.classList.remove('active'));
    chip.classList.add('active');
    showToast(`Bộ lọc demo: ${chip.textContent.trim()}`);
  });
});

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!reduceMotion && 'IntersectionObserver' in window) {
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
  menuButton?.setAttribute('aria-expanded', 'false');
  menuButton?.setAttribute('aria-label', 'Mở menu');
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

if (!reduceMotion) {
  const heroImage = document.querySelector('.hero-media img');
  let parallaxFrame = 0;

  window.addEventListener('scroll', () => {
    if (!heroImage || parallaxFrame) return;
    parallaxFrame = requestAnimationFrame(() => {
      parallaxFrame = 0;
      const y = Math.min(window.scrollY * 0.055, 24);
      heroImage.style.translate = `0 ${y}px`;
    });
  }, { passive: true });
}
