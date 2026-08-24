(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  // EST / ENG — the persistent control covers navigation and the interactive studio tools.
  const languageKey = 'siht-disain-language';
  const initialLanguage = new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : (localStorage.getItem(languageKey) === 'en' ? 'en' : 'et');
  function applyLanguage(language, updateUrl = false) {
    document.documentElement.lang = language;
    document.documentElement.dataset.language = language;
    $$('[data-et][data-en]').forEach(element => { element.innerHTML = element.dataset[language]; });
    $$('[data-placeholder-et][data-placeholder-en]').forEach(element => { element.placeholder = element.dataset[`placeholder${language === 'en' ? 'En' : 'Et'}`]; });
    $$('[data-aria-label-et][data-aria-label-en]').forEach(element => { element.setAttribute('aria-label', element.dataset[`ariaLabel${language === 'en' ? 'En' : 'Et'}`]); });
    $$('[data-language-toggle]').forEach(control => {
      const active = control.dataset.languageToggle === language;
      control.classList.toggle('is-active', active);
      control.setAttribute('aria-pressed', String(active));
      control.setAttribute('aria-current', active ? 'true' : 'false');
    });
    const form = $('[data-newsletter-form]');
    if (form) form.dataset.language = language;
    localStorage.setItem(languageKey, language);
    if (updateUrl) {
      const url = new URL(location.href);
      url.searchParams.set('lang', language);
      history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }
    window.dispatchEvent(new CustomEvent('siht-language-change', { detail: language }));
  }
  applyLanguage(initialLanguage);
  $$('[data-language-toggle]').forEach(control => control.addEventListener('click', event => {
    event.preventDefault();
    applyLanguage(control.dataset.languageToggle === 'en' ? 'en' : 'et', true);
  }));

  // Offer calculator: useful indicative price, then carries choices straight to the real contact form.
  const calculator = $('[data-calculator]');
  const calculatorResult = $('[data-calculator-result]');
  function calculateOffer() {
    if (!calculator || !calculatorResult) return;
    const data = new FormData(calculator);
    const type = String(data.get('type') || 'branding');
    const scope = Number(data.get('scope') || 1);
    const extras = data.getAll('extra');
    const bases = { branding: 1500, web: 2200, combo: 3900, packaging: 1700, uiux: 1900 };
    const time = { branding: '3–5 nädalat', web: '4–7 nädalat', combo: '6–10 nädalat', packaging: '3–6 nädalat', uiux: '4–7 nädalat' };
    const service = { branding: 'Logo & bränding', web: 'Web design', combo: 'Bränd + veeb', packaging: 'Pakendi disain', uiux: 'UI / UX' };
    const extrasTotal = extras.reduce((total, item) => total + ({ strategy: 450, copy: 350, launch: 550 }[item] || 0), 0);
    const amount = Math.round(((bases[type] || bases.branding) * scope + extrasTotal) / 50) * 50;
    calculatorResult.dataset.service = service[type];
    calculatorResult.dataset.amount = String(amount);
    calculatorResult.innerHTML = `<span>${document.documentElement.lang === 'en' ? 'INDICATIVE STARTING FROM' : 'ORIENTEERUV ALTES'}</span><strong>${new Intl.NumberFormat(document.documentElement.lang === 'en' ? 'en-GB' : 'et-EE').format(amount)} €</strong><small>${document.documentElement.lang === 'en' ? 'Typical timeline' : 'Tavaline ajaraam'}: ${time[type]}</small>`;
  }
  calculator?.addEventListener('input', calculateOffer);
  calculator?.addEventListener('change', calculateOffer);
  calculateOffer();
  $('[data-calc-to-contact]')?.addEventListener('click', () => {
    const contact = $('#contact');
    const service = calculatorResult?.dataset.service;
    const amount = Number(calculatorResult?.dataset.amount || 0);
    const select = $('#contact-form select[name="service"]');
    const budget = $('#contact-form select[name="budget"]');
    if (service && select) select.value = service;
    if (budget) budget.value = amount < 1500 ? 'Alla 1 500 €' : amount < 3000 ? '1 500 – 3 000 €' : amount < 6000 ? '3 000 – 6 000 €' : '6 000 €+';
    contact?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
  });

  // A small colour playground — palette hex values are directly copyable.
  const palettes = {
    signal: { name: 'SIGNAL', colors: ['#FF5B00', '#FFB000', '#0A0A0A', '#F5F2EC'] },
    mineral: { name: 'MINERAAL', colors: ['#9CB4A0', '#1B352C', '#DBE5DB', '#101411'] },
    nocturne: { name: 'NOCTURNE', colors: ['#7B61FF', '#211A45', '#B6A7FF', '#09090D'] },
    rosso: { name: 'ROSSO', colors: ['#D9362B', '#FFCDC1', '#31110E', '#F7F0E8'] }
  };
  const palettePreview = $('[data-palette-preview]');
  const paletteName = $('[data-palette-name]');
  const paletteCode = $('[data-palette-code]');
  function choosePalette(name) {
    const palette = palettes[name] || palettes.signal;
    if (!palettePreview) return;
    palettePreview.innerHTML = palette.colors.map((color, index) => `<button type="button" style="--swatch:${color}" data-copy-color="${color}" aria-label="Kopeeri ${color}"><span>${String(index + 1).padStart(2, '0')}</span><b>${color}</b></button>`).join('');
    paletteName.textContent = palette.name;
    paletteCode.textContent = palette.colors.join('  ·  ');
    palettePreview.style.setProperty('--palette-main', palette.colors[0]);
    $$('[data-palette]').forEach(button => button.classList.toggle('is-active', button.dataset.palette === name));
  }
  $$('[data-palette]').forEach(button => button.addEventListener('click', () => choosePalette(button.dataset.palette)));
  palettePreview?.addEventListener('click', async event => {
    const swatch = event.target.closest('[data-copy-color]');
    if (!swatch) return;
    const color = swatch.dataset.copyColor;
    try {
      await navigator.clipboard.writeText(color);
      swatch.classList.add('is-copied');
      window.setTimeout(() => swatch.classList.remove('is-copied'), 1000);
    } catch { window.prompt('Kopeeri värv:', color); }
  });
  choosePalette('signal');

  // Newsletter records are stored server-side and can be exported from the owner area.
  const newsletter = $('[data-newsletter-form]');
  newsletter?.addEventListener('submit', async event => {
    event.preventDefault();
    const status = $('[data-newsletter-status]', newsletter);
    const button = $('button[type="submit"]', newsletter);
    if (!newsletter.reportValidity()) return;
    button.disabled = true;
    status.textContent = 'LIITUN…';
    try {
      const data = new FormData(newsletter);
      const response = await fetch('/api/newsletter', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email: data.get('email'), consent: data.get('consent') === 'on', website: data.get('website'), language: newsletter.dataset.language || 'et' })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) throw new Error(result.error || 'Midagi läks valesti.');
      newsletter.reset();
      status.textContent = result.alreadySubscribed ? 'OLED JUBA KIRJAS ✓' : 'TERE TULEMAST SIHT KIRJAS ✓';
      status.classList.add('is-success');
    } catch (error) {
      status.textContent = error.message || 'PROOVI HILJEM UUESTI.';
      status.classList.remove('is-success');
    } finally { button.disabled = false; }
  });

  // FAQ chat stays deliberately lightweight: no third-party AI, no visitor content leaves the browser.
  const chat = $('[data-faq-chat]');
  const chatToggle = $('[data-chat-toggle]');
  const chatAnswer = $('[data-chat-answer]');
  const chatInput = $('[data-chat-input]');
  const answers = {
    price: 'Hind sõltub töö mahust. Pakkumise kalkulaator annab kohe hea lähtepunkti ning täpse pakkumise saad pärast lühikest tutvumist.',
    timing: 'Enamiku projektide ajaraam on 3–7 nädalat. Kui sul on kindel tähtaeg, kirjuta see päringusse – vaatame võimalused üle.',
    start: 'Alustamiseks piisab ideest, eesmärgist või probleemist. Logo, Pinterest-tahvel ja valmis brief ei ole kohustuslikud.',
    files: 'Jah. Kontaktivormi kaudu saab lisada JPG-, PNG-, WEBP- või PDF-faile – näiteks olemasoleva logo või inspiratsioonitahvli.'
  };
  function setChatAnswer(answer) { if (chatAnswer) chatAnswer.textContent = answer; }
  function updateChatVisibility() {
    chatToggle?.classList.toggle('is-ready', window.scrollY > window.innerHeight * 0.72);
  }
  updateChatVisibility();
  window.addEventListener('scroll', updateChatVisibility, { passive: true });
  chatToggle?.addEventListener('click', () => {
    const open = !chat.classList.contains('is-open');
    chat.classList.toggle('is-open', open);
    chatToggle.setAttribute('aria-expanded', String(open));
    if (open) window.setTimeout(() => chatInput?.focus(), 150);
  });
  $('[data-chat-close]')?.addEventListener('click', () => { chat.classList.remove('is-open'); chatToggle?.setAttribute('aria-expanded', 'false'); });
  $$('[data-chat-question]').forEach(button => button.addEventListener('click', () => setChatAnswer(answers[button.dataset.chatQuestion] || answers.start)));
  $('[data-chat-form]')?.addEventListener('submit', event => {
    event.preventDefault();
    const value = chatInput?.value.trim().toLowerCase() || '';
    if (!value) return;
    if (/hind|eelarve|maks/.test(value)) setChatAnswer(answers.price);
    else if (/aeg|kaua|tähtaeg/.test(value)) setChatAnswer(answers.timing);
    else if (/fail|pilt|pdf/.test(value)) setChatAnswer(answers.files);
    else setChatAnswer('Sellele küsimusele annab kõige täpsema vastuse otse SIHT DISAIN. Jäta kontaktivormi oma mõte ja vastame 24 tunni jooksul.');
    chatInput.value = '';
  });

  // Easter egg and a very small celebratory detail for people who find the SIHT sequence.
  let sequence = '';
  let clickCount = 0;
  let clickTimer;
  function revealSiht() {
    document.body.classList.add('siht-found');
    const toast = $('[data-easter-toast]');
    toast?.classList.add('is-visible');
    window.setTimeout(() => { document.body.classList.remove('siht-found'); toast?.classList.remove('is-visible'); }, 2800);
  }
  window.addEventListener('keydown', event => {
    if (event.key.length !== 1) return;
    sequence = `${sequence}${event.key.toLowerCase()}`.slice(-4);
    if (sequence === 'siht') { sequence = ''; revealSiht(); }
  });
  $$('.logo, .footer-logo').forEach(logo => logo.addEventListener('click', () => {
    clickCount += 1;
    clearTimeout(clickTimer);
    clickTimer = window.setTimeout(() => { clickCount = 0; }, 900);
    if (clickCount >= 4) { clickCount = 0; revealSiht(); }
  }));
})();
