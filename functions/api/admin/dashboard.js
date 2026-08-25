import { json, requireAdmin } from '../../lib/admin.js';
import { getDashboardSnapshot } from '../../lib/insights.js';

export async function onRequestGet({ request, env }) {
  if (!await requireAdmin(request, env)) return json({ success: false, error: 'Sisselogimine on vajalik.' }, 401);
  return json({ success: true, ...(await getDashboardSnapshot(env)) });
}
