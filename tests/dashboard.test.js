import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost as insightPost } from '../functions/api/insights.js';
import { onRequestGet as dashboardGet } from '../functions/api/admin/dashboard.js';
import { onRequestPut as settingsPut } from '../functions/api/admin/settings.js';
import { onRequestGet as healthGet } from '../functions/api/admin/health.js';
import { logActivity } from '../functions/lib/insights.js';

function createKv() {
  const values = new Map();
  return {
    async get(key, options) {
      const value = values.get(key) || null;
      return options?.type === 'json' && value ? JSON.parse(value) : value;
    },
    async put(key, value) { values.set(key, String(value)); },
    async delete(key) { values.delete(key); },
    async list({ prefix = '', limit = 1000 }) {
      const names = [...values.keys()].filter(key => key.startsWith(prefix)).sort().slice(0, limit);
      return { keys: names.map(name => ({ name })), list_complete: true };
    }
  };
}

function environment() {
  return {
    CONTACT_RATE_LIMIT: createKv(),
    CONTACT_EMAIL: 'owner@example.com',
    EMAIL_FROM: 'SIHT DISAIN <hello@example.com>',
    RESEND_API_KEY: 're_test',
    TURNSTILE_SECRET_KEY: 'turnstile_test',
    PORTFOLIO_MEDIA: { put() {} }
  };
}

function request(path, method = 'GET', body, cookie = '') {
  return new Request(`https://www.sihtdisain.ee${path}`, {
    method,
    headers: { Origin: 'https://www.sihtdisain.ee', 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
}

test('dashboard combines anonymous clicks, contact activity, and stored reminders', async () => {
  const env = environment();
  const session = '00000000-0000-4000-8000-000000000000';
  const cookie = `sd_admin_session=${session}`;
  await env.CONTACT_RATE_LIMIT.put(`admin:session:${session}`, JSON.stringify({ role: 'owner' }));

  const visitorA = '11111111-1111-4111-8111-111111111111';
  const visitorB = '22222222-2222-4222-8222-222222222222';
  await insightPost({ request: request('/api/insights', 'POST', { type: 'pageview', page: '/', session: visitorA }), env });
  await insightPost({ request: request('/api/insights', 'POST', { type: 'pageview', page: '/portfolio', session: visitorB }), env });
  await insightPost({ request: request('/api/insights', 'POST', { type: 'click', name: 'contact_cta', page: '/', session: visitorA }), env });
  await logActivity(env, { type: 'contact_submitted', message: 'Lizelle saatis päringu' });

  const saved = await settingsPut({ request: request('/api/admin/settings', 'PUT', { domainExpiry: '2027-08-01', sslExpiry: '2027-05-01' }, cookie), env });
  assert.equal(saved.status, 200);

  const response = await dashboardGet({ request: request('/api/admin/dashboard', 'GET', null, cookie), env });
  const data = await response.json();
  assert.equal(data.summary.pageViewsToday, 2);
  assert.equal(data.summary.uniqueVisitorsToday, 2);
  assert.equal(data.summary.buttonClicksToday, 1);
  assert.equal(data.summary.contactRequestsToday, 1);
  assert.equal(data.clicks[0].name, 'contact_cta');
  assert.ok(data.activity.some(item => item.message === 'Lizelle saatis päringu'));
  assert.equal(data.activity[0].message, 'Domeeni ja SSL-i tähtajad uuendati.');
  assert.equal(data.settings.domainExpiry, '2027-08-01');
});

test('owner health check tests public routes without exposing settings', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('ok', { status: 200 });
  try {
    const env = environment();
    const session = '00000000-0000-4000-8000-000000000000';
    await env.CONTACT_RATE_LIMIT.put(`admin:session:${session}`, JSON.stringify({ role: 'owner' }));
    const response = await healthGet({ request: request('/api/admin/health', 'GET', null, `sd_admin_session=${session}`), env });
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.healthy, true);
    assert.equal(data.statuses.pages.length, 3);
    assert.equal(data.statuses.contactForm, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('analytics endpoint accepts only requests from this site', async () => {
  const env = environment();
  const external = new Request('https://www.sihtdisain.ee/api/insights', {
    method: 'POST',
    headers: { Origin: 'https://attacker.example', 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'pageview', page: '/', session: '11111111-1111-4111-8111-111111111111' })
  });
  const response = await insightPost({ request: external, env });
  assert.equal(response.status, 403);
});
