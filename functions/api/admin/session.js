import { json, requireAdmin } from '../../lib/admin.js';

export async function onRequestGet({ request, env }) {
  return json({ authenticated: Boolean(await requireAdmin(request, env)) });
}
