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
  const dashboard = document.querySelector('[data-dashboard]');
  const dashboardPageViews = document.querySelector('[data-dash-pageviews]');
  const dashboardVisitors = document.querySelector('[data-dash-visitors]');
  const dashboardClicks = document.querySelector('[data-dash-clicks]');
  const dashboardContacts = document.querySelector('[data-dash-contacts]');
  const clickList = document.querySelector('[data-click-list]');
  const clicksTotal = document.querySelector('[data-clicks-total]');
  const activityList = document.querySelector('[data-activity-list]');
  const activityTotal = document.querySelector('[data-activity-total]');
  const bookingList = document.querySelector('[data-bookings-list]');
  const bookingsTotal = document.querySelector('[data-bookings-total]');
  const healthCard = document.querySelector('.admin-health-card');
  const healthTitle = document.querySelector('[data-health-title]');
  const healthCopy = document.querySelector('[data-health-copy]');
  const healthList = document.querySelector('[data-health-list]');
  const healthTime = document.querySelector('[data-health-time]');
  const domainExpiry = document.querySelector('[data-domain-expiry]');
  const sslExpiry = document.querySelector('[data-ssl-expiry]');
  const domainCount = document.querySelector('[data-domain-count]');
  const sslCount = document.querySelector('[data-ssl-count]');
  const expiryForm = document.querySelector('[data-expiry-form]');
  const expiryStatus = document.querySelector('[data-expiry-status]');
  const teamList = document.querySelector('[data-team-list]');
  const teamCount = document.querySelector('[data-team-count]');
  const teamForm = document.querySelector('[data-team-form]');
  const teamEmpty = document.querySelector('[data-team-empty]');
  const teamFormTitle = document.querySelector('[data-team-form-title]');
  const teamFormMode = document.querySelector('[data-team-form-mode]');
  const teamPhotoPreview = document.querySelector('[data-team-photo-preview]');
  const teamPhotoUpload = document.querySelector('[data-team-photo-upload]');
  const teamSaveStatus = document.querySelector('[data-team-save-status]');
  let challengeId = '';
  let projects = [];
  let editingId = '';
  let teamMembers = [];
  let editingTeamId = '';

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
      const [data, teamData] = await Promise.all([api('/api/admin/projects'), api('/api/admin/team')]);
      projects = data.managed ? data.projects : clone(staticProjects);
      teamMembers = teamData.members || [];
      renderList();
      renderTeamList();
      setStatus(saveStatus, data.managed ? 'Portfolio on valmis muutmiseks.' : 'Esimesel salvestamisel tuuakse olemasolev portfolio haldusalasse.', data.managed ? 'success' : '');
      loadDashboard();
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

  function renderTeamList() {
    if (!teamList || !teamCount) return;
    teamCount.textContent = String(teamMembers.length).padStart(2, '0');
    teamList.innerHTML = teamMembers.map((member, index) => {
      const visual = member.image
        ? `<img src="${escapeAttribute(member.image)}" alt="" />`
        : `<span class="admin-team-initials">${escapeHtml(initials(member.name))}</span>`;
      return `<button class="admin-project-item admin-team-member-item ${member.id === editingTeamId ? 'is-active' : ''}" type="button" data-edit-team-member="${escapeAttribute(member.id)}">${visual}<span><strong>${String(index + 1).padStart(2, '0')} / ${escapeHtml(member.name)}</strong><small>${escapeHtml(member.role)}</small></span><i>↗</i></button>`;
    }).join('') || '<p class="admin-status">Ühtegi töötajat veel pole.</p>';
  }

  function initials(name) {
    return String(name || '').split(/\s+/).filter(Boolean).map(part => part[0]).join('').slice(0, 2).toUpperCase() || 'SIHT';
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

  function startNewTeamMember() {
    if (!teamForm) return;
    editingTeamId = '';
    teamForm.reset();
    teamFormMode.textContent = 'UUS MEESKONNA LIIGE';
    teamFormTitle.textContent = 'UUS TÖÖTAJA';
    teamForm.elements.image.value = '';
    renderTeamPhoto('');
    teamEmpty.hidden = true;
    teamForm.hidden = false;
    setStatus(teamSaveStatus, 'Lisa nimi, roll ja lühike tutvustus. Pilt on valikuline.');
    renderTeamList();
    teamForm.elements.name.focus();
    window.scrollTo({ top: teamForm.getBoundingClientRect().top + window.scrollY - 18, behavior: 'smooth' });
  }

  function editTeamMember(id) {
    const member = teamMembers.find(item => item.id === id);
    if (!member || !teamForm) return;
    editingTeamId = id;
    teamForm.reset();
    teamFormMode.textContent = 'MEESKONNA LIIGE';
    teamFormTitle.textContent = member.name;
    teamForm.elements.name.value = member.name;
    teamForm.elements.role.value = member.role;
    teamForm.elements.intro.value = member.intro;
    teamForm.elements.image.value = member.image || '';
    renderTeamPhoto(member.image);
    teamEmpty.hidden = true;
    teamForm.hidden = false;
    setStatus(teamSaveStatus, '');
    renderTeamList();
    window.scrollTo({ top: teamForm.getBoundingClientRect().top + window.scrollY - 18, behavior: 'smooth' });
  }

  function renderTeamPhoto(source) {
    if (!teamPhotoPreview) return;
    teamPhotoPreview.innerHTML = source ? `<img src="${escapeAttribute(source)}" alt="Töötaja pildi eelvaade" />` : '<span>PILTI POLE</span>';
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

  async function uploadImages(files, statusTarget = saveStatus) {
    const selected = [...files];
    if (!selected.length) return [];
    const uploads = [];
    for (const file of selected) {
      const body = new FormData();
      body.append('image', file);
      setStatus(statusTarget, `Laen üles: ${file.name}`);
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

  function collectTeamMember() {
    return {
      id: editingTeamId || `member-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
      name: teamForm.elements.name.value.trim(),
      role: teamForm.elements.role.value.trim(),
      intro: teamForm.elements.intro.value.trim(),
      image: teamForm.elements.image.value.trim()
    };
  }

  async function saveProjects(nextProjects, message) {
    setStatus(saveStatus, 'Salvestan…');
    const data = await api('/api/admin/projects', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projects: nextProjects }) });
    projects = data.projects;
    setStatus(saveStatus, message, 'success');
    return data;
  }

  async function saveTeam(nextMembers, message) {
    setStatus(teamSaveStatus, 'Salvestan…');
    const data = await api('/api/admin/team', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ members: nextMembers }) });
    teamMembers = data.members;
    setStatus(teamSaveStatus, message, 'success');
    renderTeamList();
    loadDashboard();
    return data;
  }

  async function loadDashboard() {
    if (!dashboard) return;
    try {
      const data = await api('/api/admin/dashboard');
      renderDashboard(data);
    } catch (error) {
      if (healthTitle) healthTitle.textContent = 'ANDMED POLE SAADAVAL';
      if (healthCopy) healthCopy.textContent = error.message;
    }
  }

  function renderDashboard(data) {
    const summary = data.summary || {};
    dashboardPageViews.textContent = formatNumber(summary.pageViewsToday);
    dashboardVisitors.textContent = formatNumber(summary.uniqueVisitorsToday);
    dashboardClicks.textContent = formatNumber(summary.buttonClicksToday);
    dashboardContacts.textContent = formatNumber(summary.contactRequestsToday);
    document.querySelector('[data-dash-pageviews-note]').textContent = `${formatNumber(summary.pageViewsWeek)} viimase 7 päeva jooksul`;
    document.querySelector('[data-dash-visitors-note]').textContent = 'ühe brauseriseansi järgi';
    document.querySelector('[data-dash-clicks-note]').textContent = 'olulised tegevused täna';
    document.querySelector('[data-dash-contacts-note]').textContent = `${formatNumber(summary.contactRequestsWeek)} viimase 7 päeva jooksul`;

    const clicks = Array.isArray(data.clicks) ? data.clicks : [];
    clicksTotal.textContent = `${clicks.reduce((total, item) => total + Number(item.count || 0), 0)} KLIKKI`;
    clickList.innerHTML = clicks.length
      ? clicks.map(item => `<li><span>${escapeHtml(clickLabel(item.name))}</span><b>${formatNumber(item.count)}</b></li>`).join('')
      : '<li><span>Andmed kogunevad pärast esimesi külastusi.</span><b>—</b></li>';

    const activity = Array.isArray(data.activity) ? data.activity : [];
    activityTotal.textContent = `${activity.length} SÜNDMUST`;
    activityList.innerHTML = activity.length
      ? activity.map(item => `<li><span class="admin-activity-mark"></span><div><strong>${escapeHtml(item.message || 'Uus tegevus')}</strong><small>${escapeHtml(item.actor || 'Veebileht')}</small></div><time datetime="${escapeAttribute(item.at || '')}">${escapeHtml(relativeTime(item.at))}</time></li>`).join('')
      : '<li><span class="admin-activity-mark"></span><div><strong>Logi ootab esimest tegevust.</strong><small>Päringud, piltide lisamine ja projektide avaldamine ilmuvad siia.</small></div><time>—</time></li>';

    renderBookings(Array.isArray(data.bookings) ? data.bookings : []);

    fillExpiry(data.settings || {});
  }

  function renderBookings(bookings) {
    if (!bookingList || !bookingsTotal) return;
    bookingsTotal.textContent = `${bookings.length} TAOTLUST`;
    if (!bookings.length) {
      bookingList.innerHTML = '<li><div><strong>Broneeringuid veel pole.</strong><small>Uued tasuta kõne taotlused koos aja, kliendi, telefoni ja auditi vastustega ilmuvad siia.</small></div></li>';
      return;
    }

    bookingList.innerHTML = bookings.map(item => {
      const phone = String(item.phone || '').replace(/[^0-9+]/g, '');
      const email = String(item.email || '').trim();
      const audit = String(item.auditSummary || '').trim();
      const message = String(item.message || '').trim();
      const contactBits = [
        email ? `<a href="mailto:${encodeURIComponent(email)}">${escapeHtml(email)}</a>` : '',
        phone ? `<a href="tel:${escapeAttribute(phone)}">${escapeHtml(item.phone)}</a>` : '',
        item.company ? escapeHtml(item.company) : ''
      ].filter(Boolean).join(' · ');
      return `<li>
        <div class="admin-booking-time"><strong>${escapeHtml(formatBookingDateTime(item.meetingDate, item.meetingTime))}</strong><small>Saabus ${escapeHtml(formatDateTime(item.at))}</small></div>
        <div class="admin-booking-client"><strong>${escapeHtml(item.name || 'Nimi puudub')}</strong><small>${contactBits || 'Kontaktandmed puuduvad'}</small></div>
        <div class="admin-booking-audit"><b>${audit ? 'BRÄNDIAUDIT' : 'AUDIT TEGEMATA'}</b><p>${escapeHtml(audit || message || 'Klient ei täitnud brändiauditit.')}</p></div>
      </li>`;
    }).join('');
  }

  function formatBookingDateTime(date, time) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) return `Aeg täpsustamisel${time ? ` · ${time}` : ''}`;
    const formatted = new Intl.DateTimeFormat('et-EE', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${date}T12:00:00`));
    return `${formatted} · ${time || 'kellaaeg täpsustamisel'}`;
  }

  function fillExpiry(settings) {
    if (domainExpiry && document.activeElement !== domainExpiry) domainExpiry.value = settings.domainExpiry || '';
    if (sslExpiry && document.activeElement !== sslExpiry) sslExpiry.value = settings.sslExpiry || '';
    renderExpiryCount(domainCount, settings.domainExpiry);
    renderExpiryCount(sslCount, settings.sslExpiry);
  }

  function renderExpiryCount(target, value) {
    if (!target) return;
    target.className = 'admin-expiry-count';
    if (!value) { target.textContent = 'Kuupäev puudub'; return; }
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const targetDate = new Date(`${value}T12:00:00`);
    const days = Math.ceil((targetDate - startOfToday) / 86400000);
    if (days < 0) { target.textContent = `Aegus ${Math.abs(days)} päeva tagasi`; target.classList.add('is-soon'); return; }
    if (days === 0) { target.textContent = 'Aegub täna'; target.classList.add('is-soon'); return; }
    target.textContent = `Aegub ${days} päeva pärast`;
    target.classList.add(days <= 30 ? 'is-soon' : 'is-good');
  }

  async function runHealthCheck() {
    const button = document.querySelector('[data-run-health]');
    if (button) { button.disabled = true; button.textContent = 'KONTROLLIN…'; }
    if (healthTitle) healthTitle.textContent = 'KONTROLLIN…';
    if (healthCopy) healthCopy.textContent = 'Kontrollin avalehte, portfooliot, API-t ning olemasolevaid ühendusi.';
    try {
      const data = await api('/api/admin/health');
      renderHealth(data);
      await loadDashboard();
    } catch (error) {
      healthCard?.classList.add('is-unhealthy');
      if (healthTitle) healthTitle.textContent = 'KONTROLL EI ÕNNESTUNUD';
      if (healthCopy) healthCopy.textContent = error.message;
    } finally {
      if (button) { button.disabled = false; button.innerHTML = 'KONTROLLI VEEBILEHTE <b>↗</b>'; }
    }
  }

  function renderHealth(data) {
    const statuses = data.statuses || {};
    healthCard?.classList.toggle('is-healthy', Boolean(data.healthy));
    healthCard?.classList.toggle('is-unhealthy', !data.healthy);
    if (healthTitle) healthTitle.textContent = data.healthy ? 'KÕIK TÖÖTAB' : 'VAJAB TÄHELEPANU';
    if (healthCopy) healthCopy.textContent = data.healthy
      ? 'Avalik veebileht, portfoolio, API ja põhisüsteemid vastasid korrektselt.'
      : 'Vähemalt üks kontroll vajab tähelepanu. Vaata ridu allpool.';
    const pages = Array.isArray(statuses.pages) ? statuses.pages : [];
    const home = pages.find(item => item.path === '/');
    const portfolio = pages.find(item => item.path === '/portfolio');
    const rows = [
      ['Avaleht', home?.ok, home?.status ? `OK · ${home.status}` : 'EI VASTA'],
      ['Portfoolio', portfolio?.ok, portfolio?.status ? `OK · ${portfolio.status}` : 'EI VASTA'],
      ['Päringuvorm', statuses.contactForm, statuses.contactForm ? 'SEADISTATUD' : 'PUUDUB SEADISTUS'],
      ['Andmete salvestus', statuses.dataStorage && statuses.imageStorage, statuses.dataStorage && statuses.imageStorage ? 'VALMIS' : 'KONTROLLI']
    ];
    healthList.innerHTML = rows.map(([label, ok, status]) => `<li><span>${escapeHtml(label)}</span><b class="${ok ? 'is-ok' : 'is-fail'}">${escapeHtml(status)}</b></li>`).join('');
    if (healthTime) healthTime.textContent = `Kontrollitud ${formatDateTime(data.checkedAt)} · HTTPS: ${statuses.secureConnection ? 'aktiivne' : 'puudub'}`;
  }

  function clickLabel(name) {
    return ({
      contact_cta: 'Kontakti CTA', contact_submit_click: 'Päringu saatmise nupp', scroll_more: 'Lehe kerimine', service_choice: 'Teenuse valik', project_open: 'Projekti avamine', faq_chat_open: 'FAQ abi avamine', faq_question: 'FAQ küsimus', newsletter_submit: 'Uudiskirjaga liitumine', copy_iban: 'IBAN-i kopeerimine', instagram_open: 'Instagrami avamine', behance_open: 'Behance’i avamine', linkedin_open: 'LinkedIni avamine', email_open: 'E-posti avamine', team_nav: 'Meeskonna navigatsioon', portfolio_nav: 'Portfoolio navigatsioon'
    })[name] || name.replace(/_/g, ' ');
  }

  function formatNumber(value) { return new Intl.NumberFormat('et-EE').format(Number(value || 0)); }
  function formatDateTime(value) { return value ? new Intl.DateTimeFormat('et-EE', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—'; }
  function relativeTime(value) {
    if (!value) return '—';
    const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000);
    if (minutes < 1) return 'just nüüd';
    if (minutes < 60) return `${minutes} min tagasi`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)} h tagasi`;
    return `${Math.floor(minutes / 1440)} p tagasi`;
  }

  requestForm?.addEventListener('submit', event => { event.preventDefault(); requestCode(); });
  verifyForm?.addEventListener('submit', event => { event.preventDefault(); verifyCode(verifyForm.elements.code.value); });
  requestNewCode?.addEventListener('click', () => { challengeId = ''; verifyForm.hidden = true; requestForm.hidden = false; requestCode(); });

  document.querySelector('[data-new-project]')?.addEventListener('click', startNewProject);
  projectList?.addEventListener('click', event => {
    const button = event.target.closest('[data-edit-project]');
    if (button) editProject(button.dataset.editProject);
  });

  document.querySelector('[data-new-team-member]')?.addEventListener('click', startNewTeamMember);
  teamList?.addEventListener('click', event => {
    const button = event.target.closest('[data-edit-team-member]');
    if (button) editTeamMember(button.dataset.editTeamMember);
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

  teamPhotoUpload?.addEventListener('change', async () => {
    try {
      const [url] = await uploadImages(teamPhotoUpload.files, teamSaveStatus);
      if (!url) return;
      teamForm.elements.image.value = url;
      renderTeamPhoto(url);
      setStatus(teamSaveStatus, 'Pilt lisatud. Vajuta nüüd „Salvesta töötaja”.', 'success');
    } catch (error) { setStatus(teamSaveStatus, error.message, 'error'); }
    teamPhotoUpload.value = '';
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

  teamForm?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!teamForm.reportValidity()) return;
    const member = collectTeamMember();
    const nextMembers = editingTeamId ? teamMembers.map(item => item.id === editingTeamId ? member : item) : [...teamMembers, member];
    try {
      await saveTeam(nextMembers, 'Salvestatud. Meeskonnaleht uuenes kohe.');
      editTeamMember(member.id);
    } catch (error) { setStatus(teamSaveStatus, error.message, 'error'); }
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

  document.querySelector('[data-delete-team-member]')?.addEventListener('click', async () => {
    if (!editingTeamId) return;
    const member = teamMembers.find(item => item.id === editingTeamId);
    if (!member || !window.confirm(`Kas eemaldad töötaja „${member.name}”?`)) return;
    try {
      await saveTeam(teamMembers.filter(item => item.id !== editingTeamId), 'Töötaja eemaldati Meeskond lehelt.');
      editingTeamId = '';
      teamForm.hidden = true;
      teamEmpty.hidden = false;
      renderTeamList();
    } catch (error) { setStatus(teamSaveStatus, error.message, 'error'); }
  });

  document.querySelector('[data-logout]')?.addEventListener('click', async () => {
    try { await api('/api/admin/login', { method: 'DELETE' }); } finally { location.reload(); }
  });

  document.querySelector('[data-refresh-dashboard]')?.addEventListener('click', loadDashboard);
  document.querySelector('[data-run-health]')?.addEventListener('click', runHealthCheck);
  expiryForm?.addEventListener('submit', async event => {
    event.preventDefault();
    setStatus(expiryStatus, 'Salvestan…');
    try {
      const data = await api('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domainExpiry: domainExpiry.value, sslExpiry: sslExpiry.value })
      });
      fillExpiry(data.settings);
      setStatus(expiryStatus, 'Kuupäevad salvestatud.', 'success');
    } catch (error) { setStatus(expiryStatus, error.message, 'error'); }
  });

  (async () => {
    try {
      const session = await api('/api/admin/session');
      if (session.authenticated) await showApp();
    } catch { /* The login screen is the safe fallback. */ }
  })();
})();
