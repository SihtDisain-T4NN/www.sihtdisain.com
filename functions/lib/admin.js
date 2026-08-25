const encoder = new TextEncoder();

export const SESSION_TTL_SECONDS = 60 * 60 * 8;

export function json(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
      ...headers
    }
  });
}

export async function readJson(request) {
  try {
    const payload = await request.json();
    return payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : null;
  } catch {
    return null;
  }
}

export function getStore(env) {
  return env.PORTFOLIO_DATA || env.CONTACT_RATE_LIMIT || null;
}

export function getSessionToken(request) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/(?:^|;\s*)sd_admin_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

export async function requireAdmin(request, env) {
  const store = getStore(env);
  const token = getSessionToken(request);
  if (!store || !token || !/^[0-9a-f-]{36}$/i.test(token)) return null;
  return (await store.get(`admin:session:${token}`, { type: 'json' })) ? { token, store } : null;
}

export async function revokeSession(request, env) {
  const store = getStore(env);
  const token = getSessionToken(request);
  if (store && token) await store.delete(`admin:session:${token}`);
}

export function sessionCookie(token) {
  return `sd_admin_session=${encodeURIComponent(token)}; Max-Age=${SESSION_TTL_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Strict`;
}

export function expiredSessionCookie() {
  return 'sd_admin_session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict';
}

export async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(String(value)));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export function getIp(request) {
  return request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
}

export function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  return !origin || origin === new URL(request.url).origin;
}

export function strictSameOrigin(request) {
  const origin = request.headers.get('Origin');
  return Boolean(origin) && origin === new URL(request.url).origin;
}

export function cleanText(value, maxLength, fallback = '') {
  if (typeof value !== 'string') return fallback;
  return value.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}
