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

function multipartRequest(body, files = []) {
  const form = new FormData();
  Object.entries(body).forEach(([key, value]) => form.append(key, value));
  files.forEach(({ blob, name }) => form.append('attachments', blob, name));
  return new Request('https://sihtdisain.com/api/contact', {
    method: 'POST',
    headers: { 'CF-Connecting-IP': '203.0.113.20' },
    body: form
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

test('POST /api/contact sends a validated PNG attachment', async () => {
  const originalFetch = globalThis.fetch;
  const outgoing = [];
  globalThis.fetch = async (url, options) => {
    outgoing.push({ url, options });
    if (String(url).includes('siteverify')) return Response.json({ success: true, hostname: 'sihtdisain.com', action: 'contact-form' });
    return Response.json({ id: 'email-id' }, { status: 200 });
  };

  try {
    const png = new Blob([new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])], { type: 'image/png' });
    const response = await onRequestPost({ request: multipartRequest(validPayload, [{ blob: png, name: 'moodboard.png' }]), env: environment() });
    assert.equal(response.status, 200);

    const resendRequest = outgoing.find(item => String(item.url).includes('api.resend.com'));
    const resendPayload = JSON.parse(resendRequest.options.body);
    assert.deepEqual(resendPayload.attachments, [{ filename: 'moodboard.png', content: 'iVBORw0KGgo=' }]);
    assert.match(resendPayload.text, /Lisatud failid: moodboard\.png/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('POST /api/contact rejects unsupported file uploads', async () => {
  const textFile = new Blob(['not an image'], { type: 'text/plain' });
  const response = await onRequestPost({ request: multipartRequest(validPayload, [{ blob: textFile, name: 'notes.txt' }]), env: environment() });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { success: false, error: 'Attachment not accepted' });
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
