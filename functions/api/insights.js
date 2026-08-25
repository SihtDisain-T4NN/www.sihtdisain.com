import { cleanText, getStore, json, strictSameOrigin } from '../lib/admin.js';
import { recordInsight } from '../lib/insights.js';

const EVENT_TYPES = new Set(['pageview', 'click']);

export function onRequestGet() {
  return json({ success: false, error: 'Method not allowed' }, 405, { Allow: 'POST' });
}

export async function onRequestPost({ request, env }) {
  if (!strictSameOrigin(request)) return json({ success: false, error: 'Vigane päring.' }, 403);
  if (!getStore(env)) return json({ success: false, error: 'Statistika pole veel saadaval.' }, 503);

  const payload = await readPayload(request);
  const event = cleanEvent(payload);
  if (!event) return json({ success: false, error: 'Vigane statistikasündmus.' }, 400);

  await recordInsight(env, event);
  return json({ success: true });
}

async function readPayload(request) {
  try {
    return JSON.parse(await request.text());
  } catch {
    return null;
  }
}

function cleanEvent(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const type = cleanText(payload.type, 20);
  const page = cleanText(payload.page, 150);
  const session = cleanText(payload.session, 100);
  const name = cleanText(payload.name, 60);
  if (!EVENT_TYPES.has(type) || !/^\/[a-z0-9_./-]*$/i.test(page) || !/^[a-z0-9-]{16,100}$/i.test(session)) return null;
  if (type === 'click' && !/^[a-z0-9_-]{2,60}$/i.test(name)) return null;
  return { type, page, session, ...(name ? { name } : {}) };
}
