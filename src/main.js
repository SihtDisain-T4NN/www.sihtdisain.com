const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const loader = document.querySelector('.loader');
const progress = document.querySelector('.loader-progress i');
const percentage = document.querySelector('.loader-progress em');
let value = 0;
const loading = setInterval(() => { value = Math.min(100, value + (value < 65 ? 11 : 7)); progress.style.width = `${value * 1.45}px`; percentage.textContent = String(value).padStart(2, '0'); if (value === 100) { clearInterval(loading); setTimeout(() => { loader.classList.add('done'); document.querySelectorAll('.hero h1 span').forEach((line, index) => setTimeout(() => line.classList.add('entered'), index * 90)); }, 170); } }, 105);

document.querySelector('.nav').classList.toggle('scrolled', scrollY > 30);
window.addEventListener('scroll', () => {
  const max = document.documentElement.scrollHeight - innerHeight;
  document.querySelector('.scroll-progress i').style.height = `${(scrollY / max) * 100}%`;
  document.querySelector('.nav').classList.toggle('scrolled', scrollY > 30);
}, { passive: true });

const observer = new IntersectionObserver(entries => entries.forEach(entry => {
  if (!entry.isIntersecting) return;
  entry.target.classList.add('in-view');
  if (entry.target.classList.contains('stats') && !entry.target.dataset.counted) {
    entry.target.dataset.counted = 'true';
    entry.target.querySelectorAll('[data-count]').forEach(el => { const end = Number(el.dataset.count), start = performance.now(), duration = 1500; const tick = now => { el.textContent = Math.round(Math.min(1, (now-start)/duration) * end); if (now-start < duration) requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
  }
}), { threshold: .17 });
document.querySelectorAll('.section-head h2, .manifesto h2, .strip-intro h2, .statement h2, .direction-finder-intro h2, .testimonial h2, .faq h2, .contact h2, .process-steps h2, .work figure, .stats').forEach(el => observer.observe(el));
const processObserver = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) activateStep([...document.querySelectorAll('.process-steps article')].indexOf(entry.target)); }), { threshold: .6 });
document.querySelectorAll('.process-steps article').forEach(step => processObserver.observe(step));
function activateStep(index) { if (index < 0) return; document.querySelectorAll('.process-steps article').forEach((el, i) => el.classList.toggle('active', i === index)); document.querySelector('.process-number').textContent = `0${index + 1}`; }

if (!reduced && innerWidth > 700) {
  const cursor = document.querySelector('.cursor'); let mx = 0, my = 0, cx = 0, cy = 0;
  addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });
  (function cursorLoop(){ cx += (mx-cx)*.16; cy += (my-cy)*.16; cursor.style.transform = `translate(${cx}px,${cy}px)`; requestAnimationFrame(cursorLoop); })();
  document.querySelectorAll('a,button,.service').forEach(el => { el.addEventListener('mouseenter', () => cursor.classList.toggle('view', el.matches('.work,.strip-card,.service'))); el.addEventListener('mouseleave', () => cursor.classList.remove('view')); });
  const follower = document.querySelector('.service-follower'); const followerImg = follower.querySelector('img');
  document.querySelectorAll('.service').forEach(service => { service.addEventListener('mouseenter', () => { followerImg.src = service.dataset.image; follower.classList.add('show'); }); service.addEventListener('mousemove', e => { follower.style.left = `${e.clientX + 28}px`; follower.style.top = `${e.clientY + 24}px`; }); service.addEventListener('mouseleave', () => follower.classList.remove('show')); });
  const glow = document.querySelector('.hero-glow'); addEventListener('mousemove', e => { glow.style.transform = `translate(${(e.clientX / innerWidth - .5) * 40}px, ${(e.clientY / innerHeight - .5) * 40}px)`; });
  document.querySelectorAll('.magnetic').forEach(button => { button.addEventListener('mousemove', e => { const r = button.getBoundingClientRect(); button.style.transform = `translate(${(e.clientX-r.left-r.width/2)*.18}px, ${(e.clientY-r.top-r.height/2)*.18}px)`; }); button.addEventListener('mouseleave', () => button.style.transform = 'translate(0,0)'); });
}

const turnstileNode = document.querySelector('.cf-turnstile');
const turnstileSiteKey = turnstileNode?.dataset.sitekey;
if (turnstileNode && turnstileSiteKey && !turnstileSiteKey.startsWith('YOUR_')) {
  const turnstileScript = document.createElement('script');
  turnstileScript.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
  turnstileScript.async = true;
  turnstileScript.defer = true;
  document.head.append(turnstileScript);
} else {
  // Keep the site clean in local/static preview until a real Turnstile site key is configured.
  turnstileNode?.closest('.turnstile-wrap')?.setAttribute('hidden', '');
}

const contactForm = document.querySelector('#contact-form');
const serviceSelect = contactForm?.querySelector('select[name="service"]');
document.querySelectorAll('[data-service-choice]').forEach(choice => choice.addEventListener('click', () => {
  if (!contactForm || !serviceSelect) return;
  document.querySelectorAll('[data-service-choice]').forEach(candidate => candidate.classList.toggle('is-selected', candidate === choice));
  const service = choice.dataset.service;
  if ([...serviceSelect.options].some(option => option.value === service)) {
    serviceSelect.value = service;
    serviceSelect.dispatchEvent(new Event('change', { bubbles: true }));
  }
  document.querySelector('#contact')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  window.setTimeout(() => contactForm.querySelector('input[name="name"]')?.focus({ preventScroll: true }), reduced ? 0 : 620);
}));

const ibanCopyButton = document.querySelector('[data-copy-value]');
ibanCopyButton?.addEventListener('click', async () => {
  const value = ibanCopyButton.dataset.copyValue;
  if (!value) return;

  try {
    await navigator.clipboard.writeText(value);
    ibanCopyButton.classList.add('is-copied');
    ibanCopyButton.innerHTML = 'KOPEERITUD ✓';
    window.setTimeout(() => {
      ibanCopyButton.classList.remove('is-copied');
      ibanCopyButton.innerHTML = 'KOPEERI IBAN <b aria-hidden="true">↗</b>';
    }, 2200);
  } catch {
    ibanCopyButton.innerHTML = 'VALI JA KOPEERI';
  }
});
contactForm?.addEventListener('submit', async event => {
  event.preventDefault();
  if (!contactForm.checkValidity()) { contactForm.reportValidity(); return; }

  const button = contactForm.querySelector('button[type="submit"]');
  const inputs = [...contactForm.querySelectorAll('input, select, textarea')];
  const success = contactForm.querySelector('.form-success');
  const error = contactForm.querySelector('.form-error');
  const originalButton = button.innerHTML;
  const values = Object.fromEntries(new FormData(contactForm));

  success.classList.remove('show');
  error.classList.remove('show');
  button.textContent = 'SAADAN...';
  button.disabled = true;
  inputs.forEach(input => input.disabled = true);

  try {
    const response = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        name: values.name,
        email: values.email,
        company: values.company,
        service: values.service,
        budget: values.budget,
        timeline: values.timeline,
        message: values.message,
        website: values.website,
        turnstileToken: values['cf-turnstile-response']
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) throw new Error(result.error || 'Contact request failed');

    contactForm.reset();
    success.classList.add('show');
    window.turnstile?.reset();
  } catch (requestError) {
    console.error('Contact form submission failed:', requestError);
    error.classList.add('show');
    window.turnstile?.reset();
  } finally {
    inputs.forEach(input => input.disabled = false);
    button.disabled = false;
    button.innerHTML = originalButton;
  }
});
