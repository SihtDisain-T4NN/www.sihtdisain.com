(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

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
    price: 'Hind sõltub töö mahust. Kirjuta meile oma ideest ja saad enne alustamist selge, mahule vastava pakkumise.',
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
