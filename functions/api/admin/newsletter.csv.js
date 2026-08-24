import { getStore, requireAdmin } from '../../lib/admin.js';

export async function onRequestGet({ request, env }) {
  if (!await requireAdmin(request, env)) return new Response('Sisselogimine on vajalik.', { status: 401 });
  const store = getStore(env);
  if (!store || typeof store.list !== 'function') return new Response('Uudiskirja andmed ei ole saadaval.', { status: 503 });

  const rows = [['E-post', 'Liitus', 'Keel']];
  let cursor;
  do {
    const page = await store.list({ prefix: 'newsletter:subscriber:', cursor, limit: 1000 });
    for (const key of page.keys || []) {
      const record = await store.get(key.name, { type: 'json' });
      if (record?.email) rows.push([record.email, record.joinedAt || '', record.language || 'et']);
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
  return new Response(`\uFEFF${csv}\n`, {
    headers: {
      'Content-Type': 'text/csv; charset=UTF-8',
      'Content-Disposition': 'attachment; filename="siht-disain-uudiskiri.csv"',
      'Cache-Control': 'no-store'
    }
  });
}
