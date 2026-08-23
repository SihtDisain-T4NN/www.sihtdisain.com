(() => {
  const projects = Array.isArray(window.SIHT_PROJECTS) ? window.SIHT_PROJECTS : [];
  const root = document.querySelector('[data-project-root]');
  const id = new URLSearchParams(location.search).get('id');
  const project = projects.find(item => String(item.id) === id);
  const escapeHtml = value => String(value).replace(/[&<>'"]/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char]));
  const image = (source, alt) => `<img src="${source}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async" width="1600" height="1000" />`;
  const attachFallbacks = () => root.querySelectorAll('img').forEach(img => img.addEventListener('error', () => { if (!img.dataset.fallback) { img.dataset.fallback = 'true'; img.src = './assets/projects/project-fallback.svg'; console.warn(`Missing project image: ${img.alt}`); } }, { once: true }));
  if (!project) {
    root.innerHTML = '<section class="project-not-found"><h1>404</h1><p>Seda projekti ei leidnud.</p><a href="./portfolio.html">← Tagasi portfooliosse</a></section>';
    return;
  }
  document.title = `${project.title} — SIHT DISAIN`;
  root.innerHTML = `<article class="project-page-main"><a class="project-back" href="./portfolio.html">← TAGASI PORTFOOLIOSSE</a><header class="project-detail-hero"><h1>${escapeHtml(project.title)}<i>.</i></h1><div class="project-detail-meta"><div>KATEGOORIA<strong>${escapeHtml(project.categoryLabel)}</strong></div><div>AASTA<strong>${escapeHtml(project.year)}</strong></div><div>TEENUSED<strong>${project.tags.map(escapeHtml).join(' / ')}</strong></div></div></header><figure class="project-detail-image">${image(project.image, `${project.title} projekti põhipilt`)}</figure><section class="project-detail-copy"><h2>PROJEKTIST<br/><i>ENDast.</i></h2><p>${escapeHtml(project.description)} Meie ülesanne oli luua lahendus, mis on selge, meeldejääv ja toimib igas vajalikus puutepunktis.</p></section><section class="project-gallery" aria-label="${escapeHtml(project.title)} galerii">${project.gallery.map((source, index) => `<figure class="project-gallery-image">${image(source, `${project.title} galerii pilt ${index + 1}`)}</figure>`).join('')}</section></article>`;
  attachFallbacks();
})();
