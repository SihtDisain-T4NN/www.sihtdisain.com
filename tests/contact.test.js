import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet, onRequestPost } from '../functions/api/contact.js';

const validPayload = {
  name: 'Mari Mets',
  email: 'mari@example.com',
  company: 'Mets OÜ',
  service: 'Logo & bränding',
  message: 'Soovin arutada uut brändiidentiteeti.',
  turnstileToken: 'test-token'
};

function createKv() {
  const store = new Map();
  return { get: key => Promise.resolve(store.get(key) || null), put: (key, value) => { store.set(key, value); return Promise.resolve(); } };
}

function environment() {
  return {
    CONTACT_EMAIL: 'owner@example.com',
    EMAIL_FROM: 'SIHT DISAIN <hello@example.com>',
    RESEND_API_KEY: 're_test',
    TURNSTILE_SECRET_KEY: 'turnstile-test',
    TURNSTILE_HOSTNAME: 'sihtdisain.com',
    CONTACT_RATE_LIMIT: createKv()
  };
}

function requestWith(body) {
  return new Request('https://sihtdisain.com/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.10' },
    body: JSON.stringify(body)
  });
}

test('GET /api/contact rejects unsupported methods', async () => {
  const response = onRequestGet();
  assert.equal(response.status, 405);
  assert.deepEqual(await response.json(), { success: false, error: 'Method not allowed' });
});

test('POST /api/contact rejects an invalid payload before external calls', async () => {
  const response = await onRequestPost({ request: requestWith({ ...validPayload, email: 'not-an-email' }), env: environment() });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { success: false, error: 'Invalid request' });
});

test('POST /api/contact rejects malformed JSON and an overlong message', async () => {
  const malformed = new Request('https://sihtdisain.com/api/contact', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad-json'
  });
  const malformedResponse = await onRequestPost({ request: malformed, env: environment() });
  assert.equal(malformedResponse.status, 400);

  const tooLong = await onRequestPost({ request: requestWith({ ...validPayload, message: 'x'.repeat(5001) }), env: environment() });
  assert.equal(tooLong.status, 400);
});

test('POST /api/contact sends validated submissions and applies rate limiting', async () => {
  const originalFetch = globalThis.fetch;
  const outgoing = [];
  globalThis.fetch = async (url, options) => {
    outgoing.push({ url, options });
    if (String(url).includes('siteverify')) return Response.json({ success: true, hostname: 'sihtdisain.com', action: 'contact-form' });
    return Response.json({ id: 'email-id' }, { status: 200 });
  };

  try {
    const env = environment();
    for (let index = 0; index < 3; index++) {
      const response = await onRequestPost({ request: requestWith(validPayload), env });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { success: true });
    }
    const blocked = await onRequestPost({ request: requestWith(validPayload), env });
    assert.equal(blocked.status, 429);
    assert.equal(outgoing.filter(item => String(item.url).includes('api.resend.com')).length, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
