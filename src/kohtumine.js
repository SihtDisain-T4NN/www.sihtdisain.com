(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const nav = document.querySelector('.meeting-nav');
  const updateNav = () => nav?.classList.toggle('scrolled', window.scrollY > 30);
  updateNav();
  window.addEventListener('scroll', updateNav, { passive: true });

  const turnstileNode = document.querySelector('.cf-turnstile');
  const siteKey = turnstileNode?.dataset.sitekey;
  if (turnstileNode && siteKey && !siteKey.startsWith('YOUR_')) {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    script.async = true;
    script.defer = true;
    document.head.append(script);
  } else {
    turnstileNode?.closest('.turnstile-wrap')?.setAttribute('hidden', '');
  }

  const form = document.querySelector('#meeting-form');
  const dateInput = form?.querySelector('input[name="meetingDate"]');
  if (dateInput) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    dateInput.min = toDateValue(tomorrow);
  }

  const audit = document.querySelector('[data-brand-audit]');
  const scoreNode = document.querySelector('[data-audit-score]');
  const titleNode = document.querySelector('[data-audit-title]');
  const copyNode = document.querySelector('[data-audit-copy]');
  const auditField = form?.querySelector('input[name="auditSummary"]');
  const auditToBooking = document.querySelector('[data-audit-to-booking]');
  const auditLabels = {
    clarity: 'Selgus', audience: 'Sihtrühm', difference: 'Eristumine', identity: 'Visuaalne identiteet',
    digital: 'Digikanalid', conversion: 'Klienditee', consistency: 'Järjepidevus', goal: 'Eesmärk'
  };

  audit?.addEventListener('change', updateAudit);
  auditToBooking?.addEventListener('click', () => {
    updateAudit();
    document.querySelector('#broneeri')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  });

  function getAudit() {
    const answers = [];
    let score = 0;
    Object.entries(auditLabels).forEach(([name, label]) => {
      const checked = audit?.querySelector(`input[name="${name}"]:checked`);
      if (!checked) return;
      score += Number(checked.value);
      answers.push(`${label}: ${checked.closest('label')?.textContent?.trim() || 'vastamata'}`);
    });
    return { score, answers, answered: answers.length };
  }

  function updateAudit() {
    const result = getAudit();
    const complete = result.answered === Object.keys(auditLabels).length;
    const scoreText = result.answered ? String(result.score) : '—';
    if (scoreNode) scoreNode.innerHTML = `${scoreText}<small>/16</small>`;

    let title = 'VALI VASTUSED.';
    let copy = 'Ükski tulemus ei ole hea ega halb. Mida ausam lähtepunkt, seda täpsemalt saame kõnes suunda anda.';
    if (result.answered) {
      if (result.score >= 12) {
        title = 'TUGEV VUNDAMENT.';
        copy = 'Sul on selge lähtepunkt. Kõnes saame keskenduda sellele, kuidas seda tugevust nähtavamaks ning kasutatavamaks teha.';
      } else if (result.score >= 7) {
        title = 'SUUND ON OLEMAS.';
        copy = 'Brändis on hea materjal olemas. Vaatame kõnes, mis vajab ühtsemat süsteemi või julgemat otsust.';
      } else {
        title = 'SELGE POTENTSIAAL.';
        copy = 'See on väga hea koht, kust alustada. Kõnes leiame ühe kõige olulisema muutuse, mis annaks brändile kohe rohkem selgust.';
      }
      if (!complete) copy += ' Täida soovi korral ülejäänud küsimused, et saada täpsem lähtepunkt.';
    }
    if (titleNode) titleNode.textContent = title;
    if (copyNode) copyNode.textContent = copy;
    if (auditField) auditField.value = result.answered ? `Tulemus ${result.score}/16. ${result.answers.join(' | ')}` : '';
  }

  form?.addEventListener('submit', async event => {
    event.preventDefault();
    updateAudit();
    if (!form.checkValidity()) { form.reportValidity(); return; }

    const button = form.querySelector('button[type="submit"]');
    const inputs = [...form.querySelectorAll('input, select, textarea')];
    const success = form.querySelector('.meeting-form-success');
    const error = form.querySelector('.meeting-form-error');
    const payload = new FormData(form);
    const originalButton = button.innerHTML;
    const focus = payload.get('callFocus') || 'Vajan suunda';
    const note = String(payload.get('note') || '').trim();
    const site = String(payload.get('websiteUrl') || '').trim();
    payload.set('message', [
      `Soovin tasuta 15-minutilist kõnet. Fookus: ${focus}.`,
      note ? `Lisamõte: ${note}` : '',
      site ? `Veeb / Instagram: ${site}` : ''
    ].filter(Boolean).join('\n'));
    payload.set('turnstileToken', String(payload.get('cf-turnstile-response') || ''));

    success.classList.remove('show');
    error.classList.remove('show');
    button.textContent = 'SAADAN...';
    button.disabled = true;
    inputs.forEach(input => input.disabled = true);

    try {
      const response = await fetch('/api/contact', { method: 'POST', headers: { Accept: 'application/json' }, body: payload });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) throw new Error(result.error || 'Booking request failed');
      form.reset();
      updateAudit();
      success.classList.add('show');
      window.turnstile?.reset();
    } catch (requestError) {
      console.error('Meeting request failed:', requestError);
      error.classList.add('show');
      window.turnstile?.reset();
    } finally {
      inputs.forEach(input => input.disabled = false);
      button.disabled = false;
      button.innerHTML = originalButton;
    }
  });

  function toDateValue(date) {
    const offset = date.getTimezoneOffset() * 60_000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 10);
  }
})();
