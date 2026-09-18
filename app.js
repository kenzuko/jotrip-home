const searchForm = document.querySelector('.search');
const searchInput = document.querySelector('#q');
const suggestionButtons = document.querySelectorAll('[data-query]');
const menuButton = document.querySelector('.menu-button');
const desktopNav = document.querySelector('.desktop-nav');
const dockSearch = document.querySelector('.dock-search');
const toast = document.querySelector('.toast');

let toastTimer;

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