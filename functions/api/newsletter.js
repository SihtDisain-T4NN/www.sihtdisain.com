import { cleanText, getIp, getStore, json, sameOrigin, sha256 } from '../lib/admin.js';
import { logActivity } from '../lib/insights.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_REQUESTS_PER_DAY = 4;

export function onRequestGet() {
  return json({ success: false, error: 'Method not allowed' }, 405, { Allow: 'POST' });
}

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ success: false, error: 'Vigane päring.' }, 403);
  const store = getStore(env);
  if (!store) return json({ success: false, error: 'Uudiskirja teenus pole veel valmis.' }, 503);

  let payload;
  try { payload = await request.json(); } catch { payload = null; }
  const email = cleanText(payload?.email, 254).toLowerCase();
  const consent = payload?.consent === true;
  const website = cleanText(payload?.website, 160);
  if (website) return json({ success: true });
  if (!EMAIL.test(email) || !consent) return json({ success: false, error: 'Sisesta korrektne e-post ja kinnita nõusolek.' }, 400);

  const ipKey = `newsletter:rate:${await sha256(getIp(request))}`;
  const attempts = Number(await store.get(ipKey) || '0');
  if (attempts >= MAX_REQUESTS_PER_DAY) return json({ success: false, error: 'Proovi palun homme uuesti.' }, 429);
  await store.put(ipKey, String(attempts + 1), { expirationTtl: 60 * 60 * 24 });

  const emailKey = `newsletter:subscriber:${await sha256(email)}`;
  const existing = await store.get(emailKey, { type: 'json' });
  if (!existing) {
    await store.put(emailKey, JSON.stringify({ email, joinedAt: new Date().toISOString(), language: cleanText(payload?.language, 2, 'et') || 'et' }));
    await logActivity(env, { type: 'newsletter_subscribed', message: 'Uus inimene liitus SIHT kirjaga.' });
  }

  return json({ success: true, alreadySubscribed: Boolean(existing) });
}
