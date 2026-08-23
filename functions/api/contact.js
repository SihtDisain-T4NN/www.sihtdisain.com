const ALLOWED_SERVICES = new Set([
  'Logo & bränding',
  'Pakendi disain',
  'Web design',
  'UI / UX',
  'Digitaalsed kampaaniad',
  'Graafiline disain'
]);

const MAX_REQUESTS_PER_HOUR = 3;
const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Cache-Control': 'no-store'
};

export function onRequestGet() {
  return json({ success: false, error: 'Method not allowed' }, 405, { Allow: 'POST' });
}

export async function onRequestPost({ request, env }) {
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return json({ success: false, error: 'Invalid request' }, 415);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: 'Invalid request' }, 400);
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json({ success: false, error: 'Invalid request' }, 400);
  }

  // Bots commonly fill hidden fields. Respond successfully without sending mail.
  if (clean(body.website, 200)) return json({ success: true }, 200);

  const submission = {
    name: clean(body.name, 120),
    email: clean(body.email, 254).toLowerCase(),
    company: clean(body.company, 160),
    service: clean(body.service, 80),
    message: clean(body.message, 5000),
    turnstileToken: clean(body.turnstileToken, 2048)
  };

  if (!isValidSubmission(submission)) {
    return json({ success: false, error: 'Invalid request' }, 400);
  }

  if (!hasRequiredConfiguration(env)) {
    console.error('Contact API is missing a required secret or binding.');
    return json({ success: false, error: 'Service unavailable' }, 503);
  }

  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
  const isAllowed = await checkRateLimit(env.CONTACT_RATE_LIMIT, ip);
  if (!isAllowed) return json({ success: false, error: 'Too many requests' }, 429);

  const turnstile = await verifyTurnstile(submission.turnstileToken, ip, env);
  if (!turnstile.success || (env.TURNSTILE_HOSTNAME && turnstile.hostname !== env.TURNSTILE_HOSTNAME) || turnstile.action !== 'contact-form') {
    console.warn('Contact form Turnstile validation failed.', turnstile['error-codes']);
    return json({ success: false, error: 'Verification failed' }, 403);
  }

  const emailResponse = await sendEmail(submission, env);
  if (!emailResponse.ok) {
    console.error('Resend email delivery failed:', emailResponse.status, await emailResponse.text());
    return json({ success: false, error: 'Service unavailable' }, 502);
  }

  return json({ success: true });
}

function clean(value, maxLength) {
  return typeof value === 'string'
    ? value.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength + 1)
    : '';
}

function isValidSubmission({ name, email, company, service, message, turnstileToken }) {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return name.length >= 2 && name.length <= 120
    && emailPattern.test(email)
    && email.length <= 254
    && company.length <= 160
    && ALLOWED_SERVICES.has(service)
    && service.length <= 80
    && message.length >= 10
    && message.length <= 5000
    && turnstileToken.length > 0
    && turnstileToken.length <= 2048;
}

function hasRequiredConfiguration(env) {
  return env.CONTACT_EMAIL && env.EMAIL_FROM && env.RESEND_API_KEY && env.TURNSTILE_SECRET_KEY && env.CONTACT_RATE_LIMIT;
}

async function checkRateLimit(kv, ip) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
  const key = `contact:${[...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')}`;
  const current = Number(await kv.get(key) || '0');
  if (current >= MAX_REQUESTS_PER_HOUR) return false;
  await kv.put(key, String(current + 1), { expirationTtl: 3600 });
  return true;
}

async function verifyTurnstile(token, remoteip, env) {
  try {
    const form = new FormData();
    form.append('secret', env.TURNSTILE_SECRET_KEY);
    form.append('response', token);
    form.append('remoteip', remoteip);
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', body: form
    });
    return response.ok ? response.json() : { success: false };
  } catch (error) {
    console.error('Turnstile verification request failed:', error);
    return { success: false };
  }
}

function sendEmail(submission, env) {
  const text = [
    'SIHT DISAIN — UUS KONTAKTIPÄRING',
    '',
    `Nimi: ${submission.name}`,
    `E-mail: ${submission.email}`,
    `Ettevõte: ${submission.company || '—'}`,
    `Soovitud teenus: ${submission.service}`,
    '',
    'Sõnum:',
    submission.message
  ].join('\n');

  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': crypto.randomUUID()
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [env.CONTACT_EMAIL],
      reply_to: submission.email,
      subject: 'Uus päring — Siht Disain',
      text
    })
  });
}

function json(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), { status, headers: { ...JSON_HEADERS, ...extraHeaders } });
}
