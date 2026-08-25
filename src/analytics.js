(() => {
  const endpoint = '/api/insights';
  const sessionKey = 'siht-analytics-session';
  const session = getSession();
  const page = location.pathname === '/index.html' ? '/' : location.pathname.replace(/\.html$/, '') || '/';

  send('pageview');

  document.addEventListener('click', event => {
    const target = event.target.closest('a, button');
    if (!target) return;
    const name = getClickName(target);
    if (name) send('click', name);
  });

  function getSession() {
    try {
      const saved = sessionStorage.getItem(sessionKey);
      if (saved && /^[a-z0-9-]{16,100}$/i.test(saved)) return saved;
      const next = crypto.randomUUID();
      sessionStorage.setItem(sessionKey, next);
      return next;
    } catch {
      return crypto.randomUUID();
    }
  }

  function getClickName(target) {
    if (target.matches('.menu-dot, [data-calc-to-contact]')) return 'contact_cta';
    if (target.matches('#contact-form button[type="submit"]')) return 'contact_submit_click';
    if (target.matches('.round-link, .portfolio-scroll-cue')) return 'scroll_more';
    if (target.matches('[data-service-choice]')) return 'service_choice';
    if (target.matches('.strip-card, .work, [data-project-card], .portfolio-featured-card, a[href*="project"]')) return 'project_open';
    if (target.matches('[data-chat-toggle]')) return 'faq_chat_open';
    if (target.matches('[data-chat-question]')) return 'faq_question';
    if (target.matches('.newsletter-form button[type="submit"]')) return 'newsletter_submit';
    if (target.matches('.copy-iban')) return 'copy_iban';
    if (target.matches('a[href*="instagram.com"]')) return 'instagram_open';
    if (target.matches('a[href*="behance.net"]')) return 'behance_open';
    if (target.matches('a[href*="linkedin.com"]')) return 'linkedin_open';
    if (target.matches('a[href^="mailto:"]')) return 'email_open';
    if (target.matches('.nav-links a[href*="team"], .mobile-menu-links a[href*="team"]')) return 'team_nav';
    if (target.matches('.nav-links a[href*="portfolio"], .mobile-menu-links a[href*="portfolio"]')) return 'portfolio_nav';
    return '';
  }

  function send(type, name = '') {
    const payload = JSON.stringify({ type, name, page, session });
    try {
      const blob = new Blob([payload], { type: 'application/json' });
      if (navigator.sendBeacon && navigator.sendBeacon(endpoint, blob)) return;
    } catch { /* fetch is the fallback. */ }
    fetch(endpoint, {
      method: 'POST',
      credentials: 'same-origin',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: payload
    }).catch(() => {});
  }
})();
