(() => {
  const menu = document.querySelector('[data-mobile-menu]');
  const toggle = document.querySelector('[data-mobile-menu-toggle]');
  const closeButton = menu?.querySelector('[data-mobile-menu-close]');
  if (!menu || !toggle || !closeButton) return;

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
