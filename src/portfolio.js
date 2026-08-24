(() => {
  let projects = Array.isArray(window.SIHT_PROJECTS) ? window.SIHT_PROJECTS : [];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const loader = document.querySelector('.portfolio-loader');
  const loaderCount = loader?.querySelector('i');
  const featuredTrack = document.querySelector('[data-featured-track]');
  const grid = document.querySelector('[data-project-grid]');
  const count = document.querySelector('.portfolio-result-count');
  const search = document.querySelector('.portfolio-search input');
  const filters = [...document.querySelectorAll('[data-filter]')];
  const heroTotal = document.querySelector('[data-portfolio-total]');
  let activeFilter = 'all';
  let query = '';

  function isEnglish() { return document.documentElement.lang === 'en'; }
  function categoryLabel(project) {
    if (!isEnglish()) return project.categoryLabel;
    return ({ branding: 'Branding', logo: 'Logo', packaging: 'Packaging', web: 'Web', uiux: 'UI / UX', campaign: 'Campaign', graphic: 'Graphic design' })[project.category] || project.categoryLabel;
  }

  function projectLink(project) { return `./project.html?id=${encodeURIComponent(project.id)}`; }
  function imageTag(project, loading = 'lazy') {
    return `<img src="${project.image}" alt="${escapeHtml(project.title)} — ${escapeHtml(project.categoryLabel)}" loading="${loading}" decoding="async" width="1600" height="1000" />`;
  }
  function cardMarkup(project, index) {
    return `<a class="portfolio-card" data-project-id="${project.id}" data-category="${project.category}" data-size="${project.size}" href="${projectLink(project)}" aria-label="${isEnglish() ? 'Open project' : 'Ava projekt'} ${escapeHtml(project.title)}"><figure class="portfolio-card-media">${imageTag(project, index < 2 ? 'eager' : 'lazy')}</figure><div class="portfolio-card-meta"><span class="portfolio-card-index">${String(index + 1).padStart(2, '0')}</span><h3>${escapeHtml(project.title)}</h3><span class="portfolio-card-year">${escapeHtml(project.year)} <i class="portfolio-card-arrow">↗</i></span></div><p class="portfolio-card-description">${escapeHtml(project.description)}</p></a>`;
  }
  function featuredMarkup(project) {
    return `<a class="portfolio-featured-card" href="${projectLink(project)}" data-project-id="${project.id}" aria-label="${isEnglish() ? 'Open project' : 'Ava projekt'} ${escapeHtml(project.title)}">${imageTag(project, 'eager')}<div class="portfolio-featured-copy"><div><h3>${escapeHtml(project.title)}</h3><p>${escapeHtml(categoryLabel(project))} / ${escapeHtml(project.year)}</p></div><b>↗</b></div></a>`;
  }
  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char]));
  }
  function setFallbacks(scope = document) {
    scope.querySelectorAll('img').forEach(image => image.addEventListener('error', () => {
      if (image.dataset.fallback) return;
      image.dataset.fallback = 'true';
      image.src = './assets/projects/project-fallback.svg';
      console.warn(`Missing project image: ${image.alt}`);
    }, { once: true }));
  }
  function render() {
    const featured = projects.filter(project => project.featured).slice(0, 4);
    if (heroTotal) heroTotal.textContent = `01—${String(projects.length).padStart(2, '0')}`;
    featuredTrack.innerHTML = featured.map(featuredMarkup).join('');
    grid.innerHTML = projects.map(cardMarkup).join('') || `<p class="portfolio-empty">${isEnglish() ? 'Projects are coming soon.' : 'Projektid lisanduvad peagi.'}</p>`;
    setFallbacks(document);
    revealCards();
    applyFilters(false);
  }
  function matches(project) {
    const filterMatch = activeFilter === 'all' || project.category === activeFilter;
    const text = `${project.title} ${project.categoryLabel} ${project.description} ${project.tags.join(' ')}`.toLowerCase();
    return filterMatch && text.includes(query);
  }
  function applyFilters(animated = true) {
    const cards = [...grid.querySelectorAll('.portfolio-card')];
    if (animated) cards.forEach(card => card.classList.add('is-filtered'));
    window.setTimeout(() => {
      let visible = 0;
      cards.forEach((card, index) => {
        const project = projects.find(item => String(item.id) === card.dataset.projectId);
        const show = project && matches(project);
        card.hidden = !show;
        card.classList.remove('is-filtered', 'is-revealed');
        if (show) { visible += 1; card.style.animationDelay = `${index * 70}ms`; card.classList.add('is-revealed'); }
      });
      count.textContent = `${visible} ${isEnglish() ? (visible === 1 ? 'PROJECT' : 'PROJECTS') : (visible === 1 ? 'PROJEKT' : 'PROJEKTI')}`;
      const empty = grid.querySelector('.portfolio-empty');
      if (!visible && !empty) grid.insertAdjacentHTML('beforeend', `<p class="portfolio-empty">${isEnglish() ? 'No projects found for this search.' : 'Selle otsinguga projekte ei leidnud.'}</p>`);
      if (visible) grid.querySelector('.portfolio-empty')?.remove();
    }, animated && !reducedMotion ? 210 : 0);
  }
  function revealCards() {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-revealed');
      observer.unobserve(entry.target);
    }), { threshold: .12 });
    grid.querySelectorAll('.portfolio-card').forEach((card, index) => { card.style.animationDelay = `${index * 70}ms`; observer.observe(card); });
  }
  function setupLoader() {
    let progress = 0;
    const interval = setInterval(() => {
      progress = Math.min(100, progress + 13);
      if (loaderCount) loaderCount.textContent = String(progress).padStart(2, '0');
      if (progress === 100) { clearInterval(interval); setTimeout(() => loader?.classList.add('done'), 180); }
    }, 85);
  }
  function setupCursor() {
    if (reducedMotion || innerWidth <= 700) return;
    const cursor = document.querySelector('.portfolio-cursor');
    let targetX = 0, targetY = 0, x = 0, y = 0;
    addEventListener('mousemove', event => { targetX = event.clientX; targetY = event.clientY; });
    (function loop() { x += (targetX - x) * .15; y += (targetY - y) * .15; cursor.style.transform = `translate(${x}px,${y}px)`; requestAnimationFrame(loop); })();
    document.addEventListener('pointerover', event => cursor.classList.toggle('is-view', Boolean(event.target.closest('.portfolio-card,.portfolio-featured-card'))));
    document.addEventListener('pointerout', event => { if (event.target.closest('.portfolio-card,.portfolio-featured-card')) cursor.classList.remove('is-view'); });
  }
  function setupRailAndParallax() {
    const rail = document.querySelector('.portfolio-featured-rail');
    const progress = document.querySelector('.portfolio-progress i');
    if (reducedMotion || innerWidth <= 700) return;
    addEventListener('scroll', () => {
      const maximum = document.documentElement.scrollHeight - innerHeight;
      progress.style.height = `${Math.max(0, scrollY / maximum) * 100}%`;
      if (rail && featuredTrack) {
        const rect = rail.getBoundingClientRect();
        const distance = rail.offsetHeight - innerHeight;
        const current = Math.max(0, Math.min(1, -rect.top / Math.max(distance, 1)));
        const overflow = Math.max(0, featuredTrack.scrollWidth - innerWidth);
        featuredTrack.style.transform = `translateX(${-overflow * current}px)`;
      }
      document.querySelectorAll('.portfolio-card-media img').forEach((image, index) => {
        const rect = image.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2 - innerHeight / 2;
        image.style.setProperty('--parallax', `${Math.max(-18, Math.min(18, midpoint * (index % 2 ? .025 : -.025)))}px`);
      });
    }, { passive: true });
  }
  function setupTransitions() {
    document.addEventListener('click', event => {
      const link = event.target.closest('.portfolio-card,.portfolio-featured-card');
      if (!link || event.metaKey || event.ctrlKey || event.shiftKey) return;
      event.preventDefault();
      document.querySelector('.portfolio-transition').classList.add('is-leaving');
      setTimeout(() => { location.href = link.href; }, reducedMotion ? 0 : 520);
    });
  }

  async function loadManagedProjects() {
    try {
      const response = await fetch('/api/portfolio', { headers: { Accept: 'application/json' } });
      if (!response.ok) return;
      const data = await response.json();
      if (!data.managed || !Array.isArray(data.projects)) return;
      projects = data.projects;
      render();
    } catch {
      // The static portfolio remains available if the optional admin storage is unavailable.
    }
  }

  if (!projects.length) { grid.innerHTML = `<p class="portfolio-empty">${isEnglish() ? 'Portfolio data was not found.' : 'Portfolio andmeid ei leitud.'}</p>`; return; }
  render(); setupLoader(); setupCursor(); setupRailAndParallax(); setupTransitions();
  filters.forEach(button => button.addEventListener('click', () => { activeFilter = button.dataset.filter; filters.forEach(item => item.classList.toggle('is-active', item === button)); applyFilters(); }));
  search?.addEventListener('input', () => { query = search.value.trim().toLowerCase(); applyFilters(); });
  window.addEventListener('siht-language-change', () => render());
  void loadManagedProjects();
})();
