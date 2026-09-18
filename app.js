const enhancementStyles = document.createElement('link');
enhancementStyles.rel = 'stylesheet';
enhancementStyles.href = 'enhancements.css';
document.head.appendChild(enhancementStyles);

const searchForm = document.querySelector('.search');
const searchInput = document.querySelector('#q');
const suggestionButtons = document.querySelectorAll('[data-query]');
const menuButton = document.querySelector('.menu-button');
const desktopNav = document.querySelector('.desktop-nav');
const dockSearch = document.querySelector('.dock-search');
const toast = document.querySelector('.toast');
const heroPhoto = document.querySelector('.hero-photo');
const parallaxPhoto = document.querySelector('[data-parallax] img');
const revealItems = document.querySelectorAll('.reveal');

let toastTimer;
let rafId = null;

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
}

function focusSearch(query = '') {
  if (!searchInput) return;
  if (query) searchInput.value = query;
  searchInput.focus({ preventScroll: true });
  searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

searchForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const query = searchInput.value.trim();

  if (!query) {
    focusSearch();
    return;
  }

  showToast('Search UI is ready - search indexing comes in the next data phase.');
});

suggestionButtons.forEach((button) => {
  button.addEventListener('click', () => focusSearch(button.dataset.query || ''));
});

dockSearch?.addEventListener('click', () => focusSearch());

menuButton?.addEventListener('click', () => {
  const isOpen = desktopNav?.classList.toggle('open') ?? false;
  menuButton.setAttribute('aria-expanded', String(isOpen));
  menuButton.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
});

desktopNav?.addEventListener('click', (event) => {
  if (!(event.target instanceof HTMLAnchorElement)) return;
  desktopNav.classList.remove('open');
  menuButton?.setAttribute('aria-expanded', 'false');
  menuButton?.setAttribute('aria-label', 'Open menu');
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  desktopNav?.classList.remove('open');
  menuButton?.setAttribute('aria-expanded', 'false');
  menuButton?.setAttribute('aria-label', 'Open menu');
});

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!reduceMotion && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '40px 0px -30px' });

  revealItems.forEach((item) => observer.observe(item));
  if (heroPhoto) observer.observe(heroPhoto);
} else {
  revealItems.forEach((item) => item.classList.add('is-visible'));
  heroPhoto?.classList.add('is-visible');
}

function updateParallax() {
  rafId = null;
  if (!parallaxPhoto || reduceMotion || window.innerWidth < 800) return;

  const rect = parallaxPhoto.parentElement.getBoundingClientRect();
  const viewport = window.innerHeight;
  if (rect.bottom < 0 || rect.top > viewport) return;

  const progress = (viewport - rect.top) / (viewport + rect.height);
  const offset = (progress - 0.5) * 14;
  parallaxPhoto.style.translate = `0 ${offset}px`;
}

window.addEventListener('scroll', () => {
  if (rafId) return;
  rafId = requestAnimationFrame(updateParallax);
}, { passive: true });

window.addEventListener('resize', updateParallax, { passive: true });
updateParallax();