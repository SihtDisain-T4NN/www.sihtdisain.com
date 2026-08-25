import { getStore, json, requireAdmin } from '../../lib/admin.js';
import { logActivity } from '../../lib/insights.js';

const PATHS = [
  ['Avaleht', '/'],
  ['Portfoolio', '/portfolio'],
  ['Projektide API', '/api/portfolio']
];

export async function onRequestGet({ request, env }) {
  if (!await requireAdmin(request, env)) return json({ success: false, error: 'Sisselogimine on vajalik.' }, 401);
  const checks = await Promise.all(PATHS.map(([name, path]) => checkPath(request, name, path)));
  const statuses = {
    pages: checks,
    secureConnection: new URL(request.url).protocol === 'https:',
    contactForm: Boolean(env.CONTACT_EMAIL && env.EMAIL_FROM && env.RESEND_API_KEY && env.TURNSTILE_SECRET_KEY),
    dataStorage: Boolean(getStore(env)),
    imageStorage: Boolean(env.PORTFOLIO_MEDIA)
  };
  const healthy = checks.every(check => check.ok) && statuses.secureConnection && statuses.contactForm && statuses.dataStorage;
  const checkedAt = new Date().toISOString();
  await logActivity(env, {
    type: 'health_check',
    actor: 'Omanik',
    message: healthy ? 'Veebilehe kontroll: kõik põhisüsteemid töötavad.' : 'Veebilehe kontroll leidis tähelepanu vajava punkti.',
    meta: { healthy: String(healthy) }
  });
  return json({ success: true, healthy, checkedAt, statuses });
}

async function checkPath(request, name, path) {
  try {
    const response = await fetch(new URL(path, request.url), {
      headers: { 'x-siht-health-check': '1' },
      redirect: 'manual'
    });
    return { name, path, ok: response.ok || [301, 302, 307, 308].includes(response.status), status: response.status };
  } catch {
    return { name, path, ok: false, status: 0 };
  }
}
