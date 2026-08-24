(() => {
  let projects = Array.isArray(window.SIHT_PROJECTS) ? window.SIHT_PROJECTS : [];
  const root = document.querySelector('[data-project-root]');
  const id = new URLSearchParams(location.search).get('id');
  const escapeHtml = value => String(value).replace(/[&<>'"]/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char]));
  const image = (source, alt) => `<img src="${escapeHtml(source)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async" width="1600" height="1000" />`;

  function copy() {
    return document.documentElement.lang === 'en'
      ? { back: '← BACK TO PORTFOLIO', category: 'CATEGORY', year: 'YEAR', services: 'SERVICES', image: 'project cover image', about: 'ABOUT<br/><i>THE PROJECT.</i>', support: 'Our role was to create a solution that is clear, memorable and works at every needed touchpoint.', case: '01 — CASE STUDY', impact: 'FROM IDEA<br/><i>TO IMPACT.</i>', gallery: 'gallery', missing: 'This project was not found.', challenge: 'CHALLENGE', solution: 'SOLUTION', result: 'RESULT' }
      : { back: '← TAGASI PORTFOOLIOSSE', category: 'KATEGOORIA', year: 'AASTA', services: 'TEENUSED', image: 'projekti põhipilt', about: 'PROJEKTIST<br/><i>ENDAST.</i>', support: 'Meie ülesanne oli luua lahendus, mis on selge, meeldejääv ja toimib igas vajalikus puutepunktis.', case: '01 — CASE STUDY', impact: 'IDEEST<br/><i>MÕJUNI.</i>', gallery: 'galerii', missing: 'Seda projekti ei leidnud.', challenge: 'VÄLJAKUTSE', solution: 'LAHENDUS', result: 'TULEMUS' };
  }

  function setMeta(attribute, name, content) {
    let node = document.head.querySelector(`meta[${attribute}="${name}"]`);
    if (!node) {
      node = document.createElement('meta');
      node.setAttribute(attribute, name);
      document.head.append(node);
    }
    node.content = content;
  }

  function updateSeo(project) {
    const title = project.seoTitle || `${project.title} — SIHT DISAIN`;
    const description = project.seoDescription || project.description;
    const canonicalUrl = `https://www.sihtdisain.ee/project.html?id=${encodeURIComponent(project.id)}`;
    const imageUrl = new URL(project.image, location.href).href;
    document.title = title;
    setMeta('name', 'description', description);
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:url', canonicalUrl);
    setMeta('property', 'og:image', imageUrl);
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', imageUrl);
    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.append(canonical); }
    canonical.href = canonicalUrl;
    let schema = document.head.querySelector('[data-project-schema]');
    if (!schema) { schema = document.createElement('script'); schema.type = 'application/ld+json'; schema.dataset.projectSchema = 'true'; document.head.append(schema); }
    schema.textContent = JSON.stringify({ '@context': 'https://schema.org', '@type': 'CreativeWork', name: project.title, description, image: imageUrl, url: canonicalUrl, creator: { '@type': 'Organization', name: 'SIHT DISAIN', url: 'https://www.sihtdisain.ee/' }, dateCreated: project.year });
  }

  function attachFallbacks() {
    root.querySelectorAll('img').forEach(img => img.addEventListener('error', () => {
      if (img.dataset.fallback) return;
      img.dataset.fallback = 'true';
      img.src = './assets/projects/project-fallback.svg';
      console.warn(`Missing project image: ${img.alt}`);
    }, { once: true }));
  }

  function render() {
    const project = projects.find(item => String(item.id) === id);
    const text = copy();
    if (!project) {
      root.innerHTML = `<section class="project-not-found"><h1>404</h1><p>${text.missing}</p><a href="./portfolio.html">${text.back}</a></section>`;
      return;
    }
    updateSeo(project);
    const caseStudy = project.caseStudy || {};
    const caseItems = [
      ['01', text.challenge, caseStudy.challenge],
      ['02', text.solution, caseStudy.solution],
      ['03', text.result, caseStudy.result]
    ].filter(([, , copy]) => copy).map(([number, title, copy]) => `<article class="project-case-item"><span>${number}</span><div><h3>${title}</h3><p>${escapeHtml(copy)}</p></div></article>`).join('');
    root.innerHTML = `<article class="project-page-main"><a class="project-back" href="./portfolio.html">${text.back}</a><header class="project-detail-hero"><h1>${escapeHtml(project.title)}<i>.</i></h1><div class="project-detail-meta"><div>${text.category}<strong>${escapeHtml(project.categoryLabel)}</strong></div><div>${text.year}<strong>${escapeHtml(project.year)}</strong></div><div>${text.services}<strong>${project.tags.map(escapeHtml).join(' / ')}</strong></div></div></header><figure class="project-detail-image">${image(project.image, `${project.title} ${text.image}`)}</figure><section class="project-detail-copy"><h2>${text.about}</h2><p>${escapeHtml(project.description)} ${text.support}</p></section>${caseItems ? `<section class="project-case-study"><div class="project-case-intro"><span>${text.case}</span><h2>${text.impact}</h2></div><div class="project-case-list">${caseItems}</div></section>` : ''}<section class="project-gallery" aria-label="${escapeHtml(project.title)} ${text.gallery}">${project.gallery.map((source, index) => `<figure class="project-gallery-image">${image(source, `${project.title} ${text.gallery} ${index + 1}`)}</figure>`).join('')}</section></article>`;
    attachFallbacks();
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
      // Keep the built-in portfolio as a safe offline fallback.
    }
  }

  render();
  window.addEventListener('siht-language-change', render);
  void loadManagedProjects();
})();
