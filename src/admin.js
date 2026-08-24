(() => {
  const staticProjects = Array.isArray(window.SIHT_PROJECTS) ? window.SIHT_PROJECTS : [];
  const login = document.querySelector('[data-admin-login]');
  const app = document.querySelector('[data-admin-app]');
  const requestForm = document.querySelector('[data-code-request]');
  const verifyForm = document.querySelector('[data-code-verify]');
  const loginStatus = document.querySelector('[data-login-status]');
  const requestNewCode = document.querySelector('[data-request-new-code]');
  const projectList = document.querySelector('[data-project-list]');
  const projectCount = document.querySelector('[data-project-count]');
  const form = document.querySelector('[data-project-form]');
  const emptyEditor = document.querySelector('[data-empty-editor]');
  const formTitle = document.querySelector('[data-form-title]');
  const formMode = document.querySelector('[data-form-mode]');
  const preview = document.querySelector('[data-project-preview]');
  const coverPreview = document.querySelector('[data-cover-preview]');
  const galleryEditor = document.querySelector('[data-gallery-editor]');
  const coverUpload = document.querySelector('[data-cover-upload]');
  const galleryUpload = document.querySelector('[data-gallery-upload]');
  const saveStatus = document.querySelector('[data-save-status]');
  let challengeId = '';
  let projects = [];
  let editingId = '';

  const clone = value => JSON.parse(JSON.stringify(value));
  const escapeHtml = value => String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  const escapeAttribute = value => escapeHtml(value).replace(/`/g, '&#96;');

  function setStatus(target, message = '', type = '') {
    target.textContent = message;
    target.classList.toggle('is-error', type === 'error');
    target.classList.toggle('is-success', type === 'success');
  }

  async function api(url, options = {}) {
    const response = await fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json', ...(options.headers || {}) }, ...options });
    let data;
    try { data = await response.json(); } catch { data = { success: false, error: 'Vastus ei ole loetav.' }; }
    if (!response.ok) throw new Error(data.error || 'Midagi läks valesti.');
    return data;
  }

  async function requestCode() {
    setStatus(loginStatus, 'Saadan koodi…');
    try {
      const data = await api('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'request-code' }) });
      challengeId = data.challengeId;
      requestForm.hidden = true;
      verifyForm.hidden = false;
      verifyForm.querySelector('input').focus();
      setStatus(loginStatus, 'Kood saadeti omaniku postkasti. Sisesta see 10 minuti jooksul.', 'success');
    } catch (error) {
      setStatus(loginStatus, error.message, 'error');
    }
  }

  async function verifyCode(code) {
    if (!challengeId) return requestCode();
    setStatus(loginStatus, 'Kontrollin koodi…');
    try {
      await api('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'verify-code', challengeId, code }) });
      await showApp();
    } catch (error) {
      setStatus(loginStatus, error.message, 'error');
    }
  }

  async function showApp() {
    login.hidden = true;
    app.hidden = false;
    setStatus(saveStatus, 'Laen portfolio andmeid…');
    try {
      const data = await api('/api/admin/projects');
      projects = data.managed ? data.projects : clone(staticProjects);
      renderList();
      setStatus(saveStatus, data.managed ? 'Portfolio on valmis muutmiseks.' : 'Esimesel salvestamisel tuuakse olemasolev portfolio haldusalasse.', data.managed ? 'success' : '');
    } catch (error) {
      login.hidden = false;
      app.hidden = true;
      setStatus(loginStatus, error.message, 'error');
    }
  }

  function renderList() {
    projectCount.textContent = String(projects.length).padStart(2, '0');
    projectList.innerHTML = projects.map((project, index) => `<button class="admin-project-item ${project.id === editingId ? 'is-active' : ''}" type="button" data-edit-project="${escapeAttribute(project.id)}"><img src="${escapeAttribute(project.image)}" alt="" /><span><strong>${String(index + 1).padStart(2, '0')} / ${escapeHtml(project.title)}</strong><small>${escapeHtml(project.categoryLabel || project.category)} · ${escapeHtml(project.year)}</small></span><i>↗</i></button>`).join('') || '<p class="admin-status">Ühtegi projekti veel pole.</p>';
  }

  function startNewProject() {
    editingId = '';
    form.reset();
    formMode.textContent = 'UUS PORTFOLIOLEHT';
    formTitle.textContent = 'UUS PROJEKT';
    preview.hidden = true;
    form.elements.year.value = String(new Date().getFullYear());
    form.elements.size.value = 'standard';
    form.elements.image.value = '';
    form.dataset.gallery = '[]';
    renderCover('');
    renderGallery();
    emptyEditor.hidden = true;
    form.hidden = false;
    setStatus(saveStatus, 'Täida väljad, lisa pildid ja vajuta salvesta.');
    renderList();
    form.elements.title.focus();
  }

  function editProject(id) {
    const project = projects.find(item => item.id === id);
    if (!project) return;
    editingId = id;
    form.reset();
    formMode.textContent = `PROJEKT / ${project.year}`;
    formTitle.textContent = project.title;
    form.elements.title.value = project.title;
    form.elements.category.value = project.category;
    form.elements.year.value = project.year;
    form.elements.description.value = project.description;
    form.elements.seoTitle.value = project.seoTitle || '';
    form.elements.seoDescription.value = project.seoDescription || '';
    form.elements.tags.value = project.tags.join(', ');
    form.elements.featured.checked = Boolean(project.featured);
    form.elements.size.value = project.size || 'standard';
    form.elements.image.value = project.image;
    form.elements.challenge.value = project.caseStudy?.challenge || '';
    form.elements.solution.value = project.caseStudy?.solution || '';
    form.elements.result.value = project.caseStudy?.result || '';
    form.dataset.gallery = JSON.stringify(project.gallery || []);
    preview.href = `./project.html?id=${encodeURIComponent(project.id)}`;
    preview.hidden = false;
    renderCover(project.image);
    renderGallery();
    emptyEditor.hidden = true;
    form.hidden = false;
    setStatus(saveStatus, '');
    renderList();
    window.scrollTo({ top: form.getBoundingClientRect().top + window.scrollY - 18, behavior: 'smooth' });
  }

  function renderCover(source) {
    coverPreview.innerHTML = source ? `<img src="${escapeAttribute(source)}" alt="Kaanepildi eelvaade" />` : '<span>PILTI POLE</span>';
  }

  function gallery() {
    try { return JSON.parse(form.dataset.gallery || '[]'); } catch { return []; }
  }

  function setGallery(images) {
    form.dataset.gallery = JSON.stringify(images);
    renderGallery();
  }

  function renderGallery() {
    galleryEditor.innerHTML = gallery().map((source, index) => `<div class="admin-gallery-card"><img src="${escapeAttribute(source)}" alt="Galerii pilt ${index + 1}" /><button class="admin-gallery-remove" type="button" data-remove-gallery="${index}" aria-label="Eemalda galerii pilt">×</button></div>`).join('') || '<p class="admin-status">Lisa vähemalt üks galerii pilt. Kaanepildi saad soovi korral ka galeriisse lisada.</p>';
  }

  async function uploadImages(files) {
    const selected = [...files];
    if (!selected.length) return [];
    const uploads = [];
    for (const file of selected) {
      const body = new FormData();
      body.append('image', file);
      setStatus(saveStatus, `Laen üles: ${file.name}`);
      const data = await api('/api/admin/upload', { method: 'POST', body });
      uploads.push(data.url);
    }
    return uploads;
  }

  function collectProject() {
    const tags = form.elements.tags.value.split(',').map(tag => tag.trim()).filter(Boolean);
    return {
      id: editingId || createProjectId(),
      title: form.elements.title.value.trim(),
      category: form.elements.category.value,
      year: form.elements.year.value.trim(),
      description: form.elements.description.value.trim(),
      seoTitle: form.elements.seoTitle.value.trim(),
      seoDescription: form.elements.seoDescription.value.trim(),
      image: form.elements.image.value.trim(),
      featured: form.elements.featured.checked,
      size: form.elements.size.value,
      tags,
      gallery: gallery(),
      caseStudy: {
        challenge: form.elements.challenge.value.trim(),
        solution: form.elements.solution.value.trim(),
        result: form.elements.result.value.trim()
      }
    };
  }

  function createProjectId() {
    return `project-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  }

  async function saveProjects(nextProjects, message) {
    setStatus(saveStatus, 'Salvestan…');
    const data = await api('/api/admin/projects', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projects: nextProjects }) });
    projects = data.projects;
    setStatus(saveStatus, message, 'success');
    return data;
  }

  requestForm?.addEventListener('submit', event => { event.preventDefault(); requestCode(); });
  verifyForm?.addEventListener('submit', event => { event.preventDefault(); verifyCode(verifyForm.elements.code.value); });
  requestNewCode?.addEventListener('click', () => { challengeId = ''; verifyForm.hidden = true; requestForm.hidden = false; requestCode(); });

  document.querySelector('[data-new-project]')?.addEventListener('click', startNewProject);
  projectList?.addEventListener('click', event => {
    const button = event.target.closest('[data-edit-project]');
    if (button) editProject(button.dataset.editProject);
  });

  coverUpload?.addEventListener('change', async () => {
    try {
      const [url] = await uploadImages(coverUpload.files);
      if (!url) return;
      form.elements.image.value = url;
      renderCover(url);
      if (!gallery().length) setGallery([url]);
      setStatus(saveStatus, 'Kaanepilt lisatud. Vajuta nüüd „Salvesta muudatused”.', 'success');
    } catch (error) { setStatus(saveStatus, error.message, 'error'); }
    coverUpload.value = '';
  });

  galleryUpload?.addEventListener('change', async () => {
    try {
      const existing = gallery();
      if (existing.length + galleryUpload.files.length > 10) throw new Error('Galeriis saab olla kuni 10 pilti.');
      const urls = await uploadImages(galleryUpload.files);
      setGallery([...existing, ...urls]);
      setStatus(saveStatus, 'Galerii pildid lisatud. Vajuta nüüd „Salvesta muudatused”.', 'success');
    } catch (error) { setStatus(saveStatus, error.message, 'error'); }
    galleryUpload.value = '';
  });

  galleryEditor?.addEventListener('click', event => {
    const button = event.target.closest('[data-remove-gallery]');
    if (!button) return;
    setGallery(gallery().filter((_, index) => index !== Number(button.dataset.removeGallery)));
    setStatus(saveStatus, 'Galerii muutus on valmis salvestamiseks.');
  });

  form?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const project = collectProject();
    if (!project.image || !project.tags.length || !project.gallery.length) return setStatus(saveStatus, 'Lisa kaanepilt, vähemalt üks märksõna ja galerii pilt.', 'error');
    const nextProjects = editingId ? projects.map(item => item.id === editingId ? project : item) : [project, ...projects];
    try {
      await saveProjects(nextProjects, 'Salvestatud. Portfolio live-leht uuenes kohe.');
      editProject(project.id);
    } catch (error) { setStatus(saveStatus, error.message, 'error'); }
  });

  document.querySelector('[data-delete-project]')?.addEventListener('click', async () => {
    if (!editingId) return;
    const project = projects.find(item => item.id === editingId);
    if (!project || !window.confirm(`Kas kustutad projekti „${project.title}”?`)) return;
    try {
      await saveProjects(projects.filter(item => item.id !== editingId), 'Projekt kustutati live-portfooliost.');
      editingId = '';
      form.hidden = true;
      emptyEditor.hidden = false;
      renderList();
    } catch (error) { setStatus(saveStatus, error.message, 'error'); }
  });

  document.querySelector('[data-logout]')?.addEventListener('click', async () => {
    try { await api('/api/admin/login', { method: 'DELETE' }); } finally { location.reload(); }
  });

  (async () => {
    try {
      const session = await api('/api/admin/session');
      if (session.authenticated) await showApp();
    } catch { /* The login screen is the safe fallback. */ }
  })();
})();
