import {
  SESSION_TTL_SECONDS,
  expiredSessionCookie,
  getIp,
  getStore,
  json,
  readJson,
  revokeSession,
  sessionCookie,
  sha256,
  strictSameOrigin
} from '../../lib/admin.js';
import { logActivity } from '../../lib/insights.js';

const CODE_TTL_SECONDS = 10 * 60;
const MAX_CODE_REQUESTS = 3;
const MAX_CODE_ATTEMPTS = 5;

export async function onRequestPost({ request, env }) {
  if (!strictSameOrigin(request)) return json({ success: false, error: 'Vigane päring.' }, 403);
  const payload = await readJson(request);
  if (!payload || !['request-code', 'verify-code'].includes(payload.action)) {
    return json({ success: false, error: 'Vigane päring.' }, 400);
  }

  const store = getStore(env);
  if (!store || !env.CONTACT_EMAIL || !env.RESEND_API_KEY || !env.EMAIL_FROM) {
    console.error('Admin login is missing storage or email configuration.');
    return json({ success: false, error: 'Haldusala pole veel seadistatud.' }, 503);
  }

  return payload.action === 'request-code'
    ? requestCode(request, env, store)
    : verifyCode(payload, env, store);
}

export async function onRequestDelete({ request, env }) {
  if (!strictSameOrigin(request)) return json({ success: false, error: 'Vigane päring.' }, 403);
  await revokeSession(request, env);
  return json({ success: true }, 200, { 'Set-Cookie': expiredSessionCookie() });
}

async function requestCode(request, env, store) {
  const rateKey = `admin:code-rate:${await sha256(getIp(request))}`;
  const requested = Number(await store.get(rateKey) || '0');
  if (requested >= MAX_CODE_REQUESTS) {
    return json({ success: false, error: 'Proovi uuesti umbes 15 minuti pärast.' }, 429);
  }

  const code = createCode();
  const challengeId = crypto.randomUUID();
  await store.put(`admin:challenge:${challengeId}`, JSON.stringify({
    codeHash: await sha256(code),
    attempts: 0,
    expiresAt: Date.now() + CODE_TTL_SECONDS * 1000
  }), { expirationTtl: CODE_TTL_SECONDS });
  await store.put(rateKey, String(requested + 1), { expirationTtl: 15 * 60 });

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': crypto.randomUUID()
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [env.CONTACT_EMAIL],
      subject: 'Sinu SIHT DISAIN haldusala sisselogimiskood',
      text: `Sinu SIHT DISAIN haldusala sisselogimiskood on: ${code}\n\nSee kood kehtib 10 minutit. Kui sina seda ei küsinud, võid kirja ignoreerida.`,
      html: `<main style="max-width:560px;margin:0 auto;padding:32px;font-family:Arial,Helvetica,sans-serif;color:#111"><p style="font-size:11px;font-weight:700;letter-spacing:.12em">SIHT DISAIN / HALDUSALA</p><h1 style="margin:0 0 22px;font-size:28px">Sisselogimiskood</h1><p style="font-size:16px;line-height:1.5">Kasuta seda ühekordset koodi haldusalasse sisenemiseks:</p><p style="margin:22px 0;padding:18px;background:#111;color:#fff;font-size:32px;font-weight:700;letter-spacing:.18em;text-align:center">${code}</p><p style="color:#666;font-size:13px;line-height:1.5">Kood kehtib 10 minutit. Kui sina seda ei küsinud, võid selle kirja ignoreerida.</p></main>`
    })
  });

  if (!response.ok) {
    console.error('Admin login code delivery failed:', response.status, await response.text());
    await store.delete(`admin:challenge:${challengeId}`);
    return json({ success: false, error: 'Koodi saatmine ei õnnestunud. Proovi uuesti.' }, 502);
  }

  return json({ success: true, challengeId, expiresIn: CODE_TTL_SECONDS });
}

async function verifyCode(payload, env, store) {
  const challengeId = typeof payload.challengeId === 'string' ? payload.challengeId : '';
  const code = typeof payload.code === 'string' ? payload.code.replace(/\s/g, '') : '';
  if (!/^[0-9a-f-]{36}$/i.test(challengeId) || !/^\d{6}$/.test(code)) {
    return json({ success: false, error: 'Kontrolli sisestatud koodi.' }, 400);
  }

  const challenge = await store.get(`admin:challenge:${challengeId}`, { type: 'json' });
  if (!challenge || !Number.isFinite(challenge.expiresAt) || challenge.expiresAt <= Date.now()) {
    if (challenge) await store.delete(`admin:challenge:${challengeId}`);
    return json({ success: false, error: 'Kood ei kehti või on aegunud.' }, 401);
  }

  if (challenge.codeHash !== await sha256(code)) {
    const attempts = Number(challenge.attempts || 0) + 1;
    if (attempts >= MAX_CODE_ATTEMPTS) {
      await store.delete(`admin:challenge:${challengeId}`);
    } else {
      await store.put(`admin:challenge:${challengeId}`, JSON.stringify({ ...challenge, attempts }), {
        expirationTtl: Math.max(1, Math.ceil((challenge.expiresAt - Date.now()) / 1000))
      });
    }
    return json({ success: false, error: 'Kood ei kehti või on aegunud.' }, 401);
  }

  await store.delete(`admin:challenge:${challengeId}`);
  const token = crypto.randomUUID();
  await store.put(`admin:session:${token}`, JSON.stringify({ role: 'owner' }), { expirationTtl: SESSION_TTL_SECONDS });
  await logActivity(env, { type: 'admin_login', actor: 'Omanik', message: 'Omanik logis haldusalasse sisse.' });
  return json({ success: true }, 200, { 'Set-Cookie': sessionCookie(token) });
}

function createCode() {
  const random = new Uint32Array(1);
  crypto.getRandomValues(random);
  return String(random[0] % 1_000_000).padStart(6, '0');
}
