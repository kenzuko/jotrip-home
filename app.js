const searchForm = document.querySelector('.search');
const searchInput = document.querySelector('#q');
const menuButton = document.querySelector('.menu-button');
const desktopNav = document.querySelector('.desktop-nav');
const dockSearch = document.querySelector('.dock-search');
const toast = document.querySelector('.toast');
const routeButton = document.querySelector('#route-demo');
const routeResult = document.querySelector('#route-result');

let toastTimer;

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
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
  showToast('Demo search: results will be connected to places, transport and live data next.');
});

dockSearch?.addEventListener('click', focusSearch);

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

routeButton?.addEventListener('click', () => {
  if (!routeResult) return;
  const willOpen = routeResult.hasAttribute('hidden');
  if (willOpen) {
    routeResult.removeAttribute('hidden');
    routeButton.textContent = 'Hide options';
  } else {
    routeResult.setAttribute('hidden', '');
    routeButton.textContent = 'Show options';
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  desktopNav?.classList.remove('open');
  menuButton?.setAttribute('aria-expanded', 'false');
});