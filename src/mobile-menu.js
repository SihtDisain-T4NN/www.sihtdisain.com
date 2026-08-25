(() => {
  const menu = document.querySelector('[data-mobile-menu]');
  const toggle = document.querySelector('[data-mobile-menu-toggle]');
  const closeButton = menu?.querySelector('[data-mobile-menu-close]');
  if (!menu || !toggle || !closeButton) return;

  const links = menu.querySelector('.mobile-menu-links');
  if (links && !links.querySelector('a[href="./team.html"]')) {
    const portfolioLink = links.querySelector('a[href="./portfolio.html"]');
    const teamLink = document.createElement('a');
    teamLink.href = './team.html';
    teamLink.innerHTML = '<span>03</span> MEESKOND';
    portfolioLink?.insertAdjacentElement('afterend', teamLink);
  }
  links?.querySelectorAll('a').forEach((link, index) => {
    const number = link.querySelector('span');
    if (number) number.textContent = String(index + 1).padStart(2, '0');
  });

  const setOpen = (open, returnFocus = false) => {
    menu.classList.toggle('is-open', open);
    menu.setAttribute('aria-hidden', String(!open));
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Sulge menüü' : 'Ava menüü');
    document.body.classList.toggle('mobile-menu-open', open);
    if ('inert' in menu) menu.inert = !open;
    if (open) requestAnimationFrame(() => closeButton.focus());
    else if (returnFocus) toggle.focus({ preventScroll: true });
  };

  setOpen(false);
  toggle.addEventListener('click', () => setOpen(!menu.classList.contains('is-open')));
  closeButton.addEventListener('click', () => setOpen(false, true));
  menu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.classList.contains('is-open')) setOpen(false, true);
  });
})();
