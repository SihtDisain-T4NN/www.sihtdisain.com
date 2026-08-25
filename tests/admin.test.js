import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost as loginPost } from '../functions/api/admin/login.js';
import { onRequestGet as managedProjectsGet, onRequestPut as managedProjectsPut } from '../functions/api/admin/projects.js';
import { onRequestGet as publicProjectsGet } from '../functions/api/portfolio.js';

function createKv() {
  const store = new Map();
  return {
    async get(key, options) {
      const value = store.get(key) || null;
      return options?.type === 'json' && value ? JSON.parse(value) : value;
    },
    async put(key, value) { store.set(key, String(value)); },
    async delete(key) { store.delete(key); }
  };
}

function environment() {
  return {
    CONTACT_EMAIL: 'owner@example.com',
    EMAIL_FROM: 'SIHT DISAIN <hello@example.com>',
    RESEND_API_KEY: 're_test',
    CONTACT_RATE_LIMIT: createKv()
  };
}

function request(url, method, body, cookie = '') {
  return new Request(`https://sihtdisain.ee${url}`, {
    method,
    headers: { 'Content-Type': 'application/json', Origin: 'https://sihtdisain.ee', 'CF-Connecting-IP': '203.0.113.77', ...(cookie ? { Cookie: cookie } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
}

const project = {
  id: 'project-test', title: 'TEST', category: 'branding', year: '2026', description: 'Selge ja hästi läbi mõeldud testprojekt.', seoTitle: 'TEST — SIHT DISAIN', seoDescription: 'Google’i jaoks mõeldud testkirjeldus.', image: './assets/projects/project-01.png', featured: true, size: 'hero', tags: ['Bränding', 'Identiteet'], gallery: ['./assets/projects/project-01.png'], caseStudy: { challenge: 'Leida selge lähtekoht.', solution: 'Luua tugev süsteem.', result: 'Projekt sai valmis.' }
};

test('admin code login protects portfolio writes and publishes saved projects', async () => {
  const originalFetch = globalThis.fetch;
  const sent = [];
  globalThis.fetch = async (url, options) => {
    sent.push({ url, options });
    return Response.json({ id: 'email-id' }, { status: 200 });
  };

  try {
    const env = environment();
    const blocked = await managedProjectsPut({ request: request('/api/admin/projects', 'PUT', { projects: [project] }), env });
    assert.equal(blocked.status, 401);

    const codeRequest = await loginPost({ request: request('/api/admin/login', 'POST', { action: 'request-code' }), env });
    assert.equal(codeRequest.status, 200);
    const { challengeId } = await codeRequest.json();
    const email = JSON.parse(sent[0].options.body);
    const code = email.text.match(/\b\d{6}\b/)[0];

    const verified = await loginPost({ request: request('/api/admin/login', 'POST', { action: 'verify-code', challengeId, code }), env });
    assert.equal(verified.status, 200);
    const cookie = verified.headers.get('Set-Cookie').split(';')[0];

    const saved = await managedProjectsPut({ request: request('/api/admin/projects', 'PUT', { projects: [project] }, cookie), env });
    assert.equal(saved.status, 200);
    assert.equal((await saved.json()).projects[0].categoryLabel, 'Bränding');

    const ownerRead = await managedProjectsGet({ request: request('/api/admin/projects', 'GET', null, cookie), env });
    assert.equal((await ownerRead.json()).managed, true);

    const publicRead = await publicProjectsGet({ env });
    const publicData = await publicRead.json();
    assert.equal(publicData.managed, true);
    assert.equal(publicData.projects[0].title, 'TEST');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('admin rejects malformed portfolio data', async () => {
  const env = environment();
  await env.CONTACT_RATE_LIMIT.put('admin:session:00000000-0000-4000-8000-000000000000', JSON.stringify({ role: 'owner' }));
  const cookie = 'sd_admin_session=00000000-0000-4000-8000-000000000000';
  const response = await managedProjectsPut({ request: request('/api/admin/projects', 'PUT', { projects: [{ ...project, image: 'javascript:alert(1)' }] }, cookie), env });
  assert.equal(response.status, 400);
});

test('admin login invalidates a one-time code after five failed attempts', async () => {
  const originalFetch = globalThis.fetch;
  const sent = [];
  globalThis.fetch = async (url, options) => {
    sent.push({ url, options });
    return Response.json({ id: 'email-id' }, { status: 200 });
  };

  try {
    const env = environment();
    const codeRequest = await loginPost({ request: request('/api/admin/login', 'POST', { action: 'request-code' }), env });
    const { challengeId } = await codeRequest.json();
    const code = JSON.parse(sent[0].options.body).text.match(/\b\d{6}\b/)[0];

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const rejected = await loginPost({ request: request('/api/admin/login', 'POST', { action: 'verify-code', challengeId, code: '000000' }), env });
      assert.equal(rejected.status, 401);
    }
    const expired = await loginPost({ request: request('/api/admin/login', 'POST', { action: 'verify-code', challengeId, code }), env });
    assert.equal(expired.status, 401);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('admin login rejects cross-site requests', async () => {
  const env = environment();
  const external = new Request('https://sihtdisain.ee/api/admin/login', {
    method: 'POST',
    headers: { Origin: 'https://attacker.example', 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'request-code' })
  });
  const response = await loginPost({ request: external, env });
  assert.equal(response.status, 403);
});
