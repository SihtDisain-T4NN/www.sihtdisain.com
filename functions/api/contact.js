const ALLOWED_SERVICES = new Set([
  'Logo & bränding',
  'Bränd + veeb',
  'Pakendi disain',
  'Web design',
  'UI / UX',
  'Digitaalsed kampaaniad',
  'Graafiline disain',
  'Vajan suunamist'
]);
const ALLOWED_BUDGETS = new Set([
  'Alla 1 500 €',
  '1 500 – 3 000 €',
  '3 000 – 6 000 €',
  '6 000 €+'
]);
const ALLOWED_TIMELINES = new Set([
  'Esimesel võimalusel',
  'Järgmise 1–2 kuu jooksul',
  'Järgmise 3–6 kuu jooksul',
  'Uurin võimalusi'
]);
const ALLOWED_ATTACHMENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf'
]);

const MAX_REQUESTS_PER_HOUR = 3;
const MAX_ATTACHMENTS = 3;
const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const MAX_MULTIPART_BYTES = MAX_TOTAL_ATTACHMENT_BYTES + 512 * 1024;
const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Cache-Control': 'no-store'
};

export function onRequestGet() {
  return json({ success: false, error: 'Method not allowed' }, 405, { Allow: 'POST' });
}

export async function onRequestPost({ request, env }) {
  const parsed = await readSubmission(request);
  if (parsed.error) return json({ success: false, error: parsed.error }, parsed.status);

  const { body, files } = parsed;

  // Bots commonly fill hidden fields. Respond successfully without sending mail.
  if (clean(body.website, 200)) return json({ success: true }, 200);

  const submission = {
    name: clean(body.name, 120),
    email: clean(body.email, 254).toLowerCase(),
    company: clean(body.company, 160),
    service: clean(body.service, 80),
    budget: clean(body.budget, 80),
    timeline: clean(body.timeline, 100),
    message: clean(body.message, 5000),
    turnstileToken: clean(body.turnstileToken, 2048),
    files
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

  let emailResponse;
  try {
    emailResponse = await sendEmail(submission, env);
  } catch (error) {
    console.warn('Contact form attachment validation failed:', error);
    return json({ success: false, error: 'Attachment not accepted' }, 400);
  }

  if (!emailResponse.ok) {
    console.error('Resend email delivery failed:', emailResponse.status, await emailResponse.text());
    return json({ success: false, error: 'Service unavailable' }, 502);
  }

  return json({ success: true });
}

async function readSubmission(request) {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    try {
      const body = await request.json();
      if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Invalid request', status: 400 };
      return { body, files: [] };
    } catch {
      return { error: 'Invalid request', status: 400 };
    }
  }

  if (!contentType.includes('multipart/form-data')) return { error: 'Invalid request', status: 415 };

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_MULTIPART_BYTES) {
    return { error: 'Attachment not accepted', status: 413 };
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return { error: 'Invalid request', status: 400 };
  }

  const files = validateAttachmentMetadata(form.getAll('attachments'));
  if (!files) return { error: 'Attachment not accepted', status: 400 };

  return {
    body: {
      name: form.get('name'),
      email: form.get('email'),
      company: form.get('company'),
      service: form.get('service'),
      budget: form.get('budget'),
      timeline: form.get('timeline'),
      message: form.get('message'),
      website: form.get('website'),
      turnstileToken: form.get('cf-turnstile-response') || form.get('turnstileToken')
    },
    files
  };
}

function validateAttachmentMetadata(values) {
  const files = [];
  let totalBytes = 0;

  for (const value of values) {
    // Browsers include one empty File when no optional file is selected.
    if (isFile(value) && value.size === 0 && !value.name) continue;
    if (!isFile(value) || !value.name || !ALLOWED_ATTACHMENT_TYPES.has(value.type)) return null;
    if (value.size <= 0 || value.size > MAX_ATTACHMENT_BYTES) return null;

    totalBytes += value.size;
    if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES || files.length >= MAX_ATTACHMENTS) return null;
    files.push(value);
  }

  return files;
}

function isFile(value) {
  return value && typeof value === 'object' && typeof value.arrayBuffer === 'function' && typeof value.name === 'string';
}

function clean(value, maxLength) {
  return typeof value === 'string'
    ? value.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength + 1)
    : '';
}

function isValidSubmission({ name, email, company, service, budget, timeline, message, turnstileToken }) {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return name.length >= 2 && name.length <= 120
    && emailPattern.test(email)
    && email.length <= 254
    && company.length <= 160
    && ALLOWED_SERVICES.has(service)
    && service.length <= 80
    && (!budget || ALLOWED_BUDGETS.has(budget))
    && budget.length <= 80
    && (!timeline || ALLOWED_TIMELINES.has(timeline))
    && timeline.length <= 100
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

async function sendEmail(submission, env) {
  const attachments = await encodeAttachments(submission.files);
  const attachmentNames = attachments.map(attachment => attachment.filename);
  const subject = `Päring: ${submission.service} — ${submission.name}`;
  const text = [
    'UUS KONTAKTIPÄRING',
    '',
    'KLIENDI ANDMED',
    `Nimi: ${submission.name}`,
    `E-post: ${submission.email}`,
    `Ettevõte: ${submission.company || 'Pole lisatud'}`,
    '',
    'PROJEKT',
    `Teenuse soov: ${submission.service}`,
    `Eelarve: ${submission.budget || 'Pole valitud'}`,
    `Ajaraam: ${submission.timeline || 'Pole valitud'}`,
    `Manused: ${attachmentNames.length ? attachmentNames.join(', ') : 'Pole lisatud'}`,
    '',
    'KLIENDI SÕNUM',
    submission.message
  ].join('\n');
  const html = createEmailHtml(submission, attachmentNames);

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
      subject,
      text,
      html,
      ...(attachments.length ? { attachments } : {})
    })
  });
}

function createEmailHtml(submission, attachmentNames) {
  const value = text => escapeHtml(text || 'Pole lisatud');
  const attachmentList = attachmentNames.length
    ? attachmentNames.map(name => `<li style="margin:0 0 6px">${escapeHtml(name)}</li>`).join('')
    : '<li style="margin:0">Pole lisatud</li>';

  return `<!doctype html>
<html lang="et">
  <body style="margin:0;background:#f4f4f2;color:#141414;font-family:Arial,Helvetica,sans-serif">
    <main style="max-width:680px;margin:0 auto;padding:32px 16px">
      <section style="overflow:hidden;background:#ffffff;border:1px solid #deded9;border-radius:18px">
        <header style="padding:28px 30px 24px;background:#101010;color:#ffffff">
          <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:.13em">SIHT DISAIN</p>
          <h1 style="margin:0;font-size:28px;line-height:1.1">Uus kontaktipäring</h1>
        </header>
        <div style="padding:30px">
          <p style="margin:0 0 24px;padding:14px 16px;border-left:3px solid #ff5b00;background:#fff5ef;font-size:15px;line-height:1.5">
            <strong>${value(submission.name)}</strong> soovib teenust: <strong>${value(submission.service)}</strong>
          </p>
          ${emailSection('Kliendi andmed', [
            ['Nimi', submission.name],
            ['E-post', `<a href="mailto:${escapeAttribute(submission.email)}" style="color:#141414">${value(submission.email)}</a>`],
            ['Ettevõte', value(submission.company)]
          ])}
          ${emailSection('Projekt', [
            ['Teenuse soov', value(submission.service)],
            ['Eelarve', value(submission.budget)],
            ['Ajaraam', value(submission.timeline)]
          ])}
          <section style="margin:30px 0 0">
            <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#696965">Kliendi sõnum</p>
            <div style="padding:18px 20px;background:#f4f4f2;border-radius:10px;font-size:16px;line-height:1.65;white-space:pre-wrap">${value(submission.message)}</div>
          </section>
          <section style="margin:30px 0 0">
            <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#696965">Lisatud failid</p>
            <ul style="margin:0;padding:14px 20px 10px 34px;background:#f4f4f2;border-radius:10px;font-size:14px;line-height:1.4">${attachmentList}</ul>
          </section>
        </div>
      </section>
      <p style="margin:16px 4px 0;color:#777773;font-size:12px;line-height:1.5">Vastamiseks vajuta Gmailis „Vasta” — vastus läheb otse kliendi e-posti aadressile.</p>
    </main>
  </body>
</html>`;
}

function emailSection(title, rows) {
  const content = rows.map(([label, value]) => `
    <tr>
      <td style="padding:10px 16px 10px 0;width:36%;color:#696965;font-size:13px;vertical-align:top">${label}</td>
      <td style="padding:10px 0;font-size:15px;vertical-align:top">${value}</td>
    </tr>`).join('');
  return `<section style="margin:30px 0 0">
    <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#696965">${title}</p>
    <table role="presentation" style="width:100%;border-collapse:collapse;border-top:1px solid #deded9">${content}</table>
  </section>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  })[character]);
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

async function encodeAttachments(files) {
  const attachments = [];
  for (const file of files) {
    const buffer = await file.arrayBuffer();
    if (!hasExpectedFileSignature(file.type, new Uint8Array(buffer))) throw new Error('Unexpected file signature');
    attachments.push({
      filename: cleanFilename(file.name),
      content: arrayBufferToBase64(buffer)
    });
  }
  return attachments;
}

function cleanFilename(filename) {
  return filename.replace(/[\\/:*?"<>|\u0000-\u001F\u007F]/g, '-').trim().slice(0, 120) || 'attachment';
}

function hasExpectedFileSignature(type, bytes) {
  if (type === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;
  if (type === 'image/png') return bytes.length >= 8 && bytes.slice(0, 8).every((byte, index) => byte === [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A][index]);
  if (type === 'image/webp') return bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  if (type === 'application/pdf') return bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-';
  return false;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let start = 0; start < bytes.length; start += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(start, start + chunkSize));
  }
  return btoa(binary);
}

function json(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), { status, headers: { ...JSON_HEADERS, ...extraHeaders } });
}
