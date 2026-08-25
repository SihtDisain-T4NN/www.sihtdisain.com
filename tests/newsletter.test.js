import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/newsletter.js';
import { onRequestGet as downloadSubscribers } from '../functions/api/admin/newsletter.csv.js';

function createKv() {
  const values = new Map();
  return {
    async get(key, options) {
      const value = values.get(key) || null;
      return options?.type === 'json' && value ? JSON.parse(value) : value;
    },
    async put(key, value) { values.set(key, String(value)); },
    async delete(key) { values.delete(key); },
    async list({ prefix = '' }) {
      return { keys: [...values.keys()].filter(key => key.startsWith(prefix)).map(name => ({ name })), list_complete: true };
    }
  };
}

function subscribeRequest(payload) {
  return new Request('https://www.sihtdisain.ee/api/newsletter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://www.sihtdisain.ee', 'CF-Connecting-IP': '203.0.113.8' },
    body: JSON.stringify(payload)
  });
}

test('newsletter stores a consented subscriber only once and owner can export it', async () => {
  const env = { CONTACT_RATE_LIMIT: createKv() };
  const first = await onRequestPost({ request: subscribeRequest({ email: 'tere@example.com', consent: true, language: 'et' }), env });
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), { success: true, alreadySubscribed: false });

  const duplicate = await onRequestPost({ request: subscribeRequest({ email: 'tere@example.com', consent: true, language: 'en' }), env });
  assert.equal((await duplicate.json()).alreadySubscribed, true);

  const session = '00000000-0000-4000-8000-000000000000';
  await env.CONTACT_RATE_LIMIT.put(`admin:session:${session}`, JSON.stringify({ role: 'owner' }));
  const csv = await downloadSubscribers({ request: new Request('https://www.sihtdisain.ee/api/admin/newsletter.csv', { headers: { Cookie: `sd_admin_session=${session}` } }), env });
  assert.equal(csv.status, 200);
  assert.match(await csv.text(), /tere@example\.com/);
});

test('newsletter requires a valid e-mail and explicit consent', async () => {
  const env = { CONTACT_RATE_LIMIT: createKv() };
  const response = await onRequestPost({ request: subscribeRequest({ email: 'not-an-email', consent: false }), env });
  assert.equal(response.status, 400);
});
