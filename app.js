const searchForm = document.querySelector('.search');
const searchInput = document.querySelector('#q');
const menuButton = document.querySelector('.menu-button');
const desktopNav = document.querySelector('.desktop-nav');
const dockSearch = document.querySelector('.dock-search');
const headerSearch = document.querySelector('.header-search');
const toast = document.querySelector('.toast');
const filterChips = document.querySelectorAll('.filter-chips button');

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
  showToast('Demo search - live indexing will connect places, schedules, transport and island data.');
});

dockSearch?.addEventListener('click', focusSearch);
headerSearch?.addEventListener('click', focusSearch);

menuButton?.addEventListener('click', () => {
  const open = desktopNav?.classList.toggle('open') ?? false;
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
});

desktopNav?.addEventListener('click', (event) => {
  if (!(event.target instanceof HTMLAnchorElement)) return;
  desktopNav.classList.remove('open');
  menuButton?.setAttribute('aria-expanded', 'false');
});

filterChips.forEach((chip) => {
  chip.addEventListener('click', () => {
    filterChips.forEach((item) => item.classList.remove('active'));
    chip.classList.add('active');
    showToast(`Demo filter: ${chip.textContent.trim()}`);
  });
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  desktopNav?.classList.remove('open');
  menuButton?.setAttribute('aria-expanded', 'false');
});