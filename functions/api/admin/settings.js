import { getStore, json, readJson, requireAdmin, sameOrigin } from '../../lib/admin.js';
import { ADMIN_SETTINGS_KEY, getAdminSettings, logActivity, normaliseSettings } from '../../lib/insights.js';

export async function onRequestGet({ request, env }) {
  if (!await requireAdmin(request, env)) return json({ success: false, error: 'Sisselogimine on vajalik.' }, 401);
  const store = getStore(env);
  return json({ success: true, settings: await getAdminSettings(store) });
}

export async function onRequestPut({ request, env }) {
  if (!sameOrigin(request)) return json({ success: false, error: 'Vigane päring.' }, 403);
  if (!await requireAdmin(request, env)) return json({ success: false, error: 'Sisselogimine on vajalik.' }, 401);
  const payload = await readJson(request);
  const settings = normaliseSettings(payload);
  if ((payload?.domainExpiry && !settings.domainExpiry) || (payload?.sslExpiry && !settings.sslExpiry)) {
    return json({ success: false, error: 'Kontrolli kuupäeva vormingut.' }, 400);
  }
  const store = getStore(env);
  await store.put(ADMIN_SETTINGS_KEY, JSON.stringify(settings));
  await logActivity(env, { type: 'expiry_updated', actor: 'Omanik', message: 'Domeeni ja SSL-i tähtajad uuendati.' });
  return json({ success: true, settings });
}
