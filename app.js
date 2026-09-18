const searchForm = document.querySelector('.search');
const searchInput = document.querySelector('#q');
const menuButton = document.querySelector('.menu-button');
const desktopNav = document.querySelector('.desktop-nav');

searchForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const query = searchInput.value.trim();
  if (!query) {
    searchInput.focus();
    return;
  }
  alert('Search prototype: ' + query);
});

menuButton?.addEventListener('click', () => {
  const isOpen = desktopNav.dataset.open === 'true';
  desktopNav.dataset.open = String(!isOpen);
  desktopNav.style.display = isOpen ? '' : 'flex';
  desktopNav.style.position = isOpen ? '' : 'absolute';
  desktopNav.style.top = isOpen ? '' : '66px';
  desktopNav.style.right = isOpen ? '' : '16px';
  desktopNav.style.flexDirection = isOpen ? '' : 'column';
  desktopNav.style.padding = isOpen ? '' : '16px';
  desktopNav.style.background = isOpen ? '' : '#FBF8F1';
  desktopNav.style.border = isOpen ? '' : '1px solid rgba(18,61,59,.12)';
  desktopNav.style.borderRadius = isOpen ? '' : '14px';
  desktopNav.style.boxShadow = isOpen ? '' : '0 12px 30px rgba(18,61,59,.12)';
});