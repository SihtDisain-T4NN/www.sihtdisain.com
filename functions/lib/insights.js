import { cleanText, getStore } from './admin.js';

const ANALYTICS_TTL_SECONDS = 60 * 60 * 24 * 90;
const ACTIVITY_TTL_SECONDS = 60 * 60 * 24 * 365;
const BOOKING_TTL_SECONDS = 60 * 60 * 24 * 365;
export const ADMIN_SETTINGS_KEY = 'admin:settings';

export async function recordInsight(env, event) {
  const store = getStore(env);
  if (!store) return false;
  const timestamp = new Date().toISOString();
  const day = timestamp.slice(0, 10);
  await store.put(`analytics:${day}:${timestamp}:${crypto.randomUUID()}`, JSON.stringify({
    ...event,
    at: timestamp
  }), { expirationTtl: ANALYTICS_TTL_SECONDS });
  return true;
}

export async function logActivity(env, { type, message, actor = 'Veebileht', meta = {} }) {
  const store = getStore(env);
  if (!store) return false;
  const date = new Date();
  const timestamp = date.toISOString();
  // Inverted millisecond value keeps the newest activity first in KV's lexical listing.
  const newestFirst = String(9_999_999_999_999 - date.getTime()).padStart(13, '0');
  await store.put(`activity:${newestFirst}:${crypto.randomUUID()}`, JSON.stringify({
    type: cleanText(type, 60),
    message: cleanText(message, 220),
    actor: cleanText(actor, 80) || 'Veebileht',
    meta: cleanMeta(meta),
    at: timestamp
  }), { expirationTtl: ACTIVITY_TTL_SECONDS });
  return true;
}

// Booking details contain personal data, so they are stored separately from
// the public analytics stream and are only returned by the authenticated admin
// dashboard endpoint. They are automatically removed after one year.
export async function recordBooking(env, booking) {
  const store = getStore(env);
  if (!store) return false;
  const date = new Date();
  const timestamp = date.toISOString();
  const newestFirst = String(9_999_999_999_999 - date.getTime()).padStart(13, '0');
  await store.put(`booking:${newestFirst}:${crypto.randomUUID()}`, JSON.stringify({
    name: cleanText(booking.name, 120),
    email: cleanText(booking.email, 254).toLowerCase(),
    phone: cleanText(booking.phone, 40),
    company: cleanText(booking.company, 160),
    meetingDate: cleanText(booking.meetingDate, 20),
    meetingTime: cleanText(booking.meetingTime, 20),
    auditSummary: cleanText(booking.auditSummary, 2000),
    message: cleanText(booking.message, 5000),
    at: timestamp
  }), { expirationTtl: BOOKING_TTL_SECONDS });
  return true;
}

export async function getDashboardSnapshot(env) {
  const store = getStore(env);
  if (!store) return emptySnapshot();

  const [events, activity, settings, bookings] = await Promise.all([
    recentAnalytics(store, 30),
    listRows(store, 'activity:', 40),
    getAdminSettings(store),
    listRows(store, 'booking:', 30)
  ]);
  const today = dayKey(new Date());
  const week = dateKeys(7);
  const todayEvents = events.filter(event => event.at?.slice(0, 10) === today);
  const weekEvents = events.filter(event => week.has(event.at?.slice(0, 10)));
  const todayActivities = activity.filter(entry => entry.at?.slice(0, 10) === today);
  const weekActivities = activity.filter(entry => week.has(entry.at?.slice(0, 10)));

  return {
    summary: {
      pageViewsToday: countByType(todayEvents, 'pageview'),
      uniqueVisitorsToday: uniqueSessions(todayEvents),
      buttonClicksToday: countByType(todayEvents, 'click'),
      contactRequestsToday: countByType(todayActivities, 'contact_submitted'),
      pageViewsWeek: countByType(weekEvents, 'pageview'),
      contactRequestsWeek: countByType(weekActivities, 'contact_submitted')
    },
    clicks: topClicks(weekEvents),
    activity,
    bookings,
    settings
  };
}

export async function getAdminSettings(store) {
  const saved = await store.get(ADMIN_SETTINGS_KEY, { type: 'json' });
  return normaliseSettings(saved);
}

export function normaliseSettings(value) {
  return {
    domainExpiry: validDate(value?.domainExpiry) ? value.domainExpiry : '',
    sslExpiry: validDate(value?.sslExpiry) ? value.sslExpiry : ''
  };
}

export async function recentAnalytics(store, days = 30) {
  const rows = await Promise.all([...dateKeys(days)].map(day => listRows(store, `analytics:${day}:`, 160)));
  return rows.flat().filter(row => row && ['pageview', 'click'].includes(row.type));
}

export async function listRows(store, prefix, maxRows = 100) {
  if (!store?.list) return [];
  const names = [];
  let cursor;
  do {
    const page = await store.list({ prefix, ...(cursor ? { cursor } : {}), limit: Math.min(100, maxRows - names.length) });
    names.push(...(page.keys || []).map(item => item.name).filter(Boolean));
    cursor = page.cursor;
    if (page.list_complete || !cursor || names.length >= maxRows) break;
  } while (true);

  const values = await Promise.all(names.slice(0, maxRows).map(name => store.get(name, { type: 'json' })));
  return values.filter(Boolean);
}

export function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

function dateKeys(days) {
  const daysSet = new Set();
  const cursor = new Date();
  cursor.setUTCHours(12, 0, 0, 0);
  for (let index = 0; index < days; index += 1) {
    daysSet.add(dayKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return daysSet;
}

function countByType(rows, type) {
  return rows.filter(row => row.type === type).length;
}

function uniqueSessions(rows) {
  return new Set(rows.filter(row => row.type === 'pageview' && row.session).map(row => row.session)).size;
}

function topClicks(events) {
  const counts = new Map();
  events.filter(event => event.type === 'click' && event.name).forEach(event => {
    counts.set(event.name, (counts.get(event.name) || 0) + 1);
  });
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((first, second) => second.count - first.count || first.name.localeCompare(second.name))
    .slice(0, 8);
}

function cleanMeta(meta) {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return {};
  return Object.fromEntries(Object.entries(meta).slice(0, 6).map(([key, value]) => [cleanText(key, 40), cleanText(String(value), 120)]));
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function emptySnapshot() {
  return {
    summary: { pageViewsToday: 0, uniqueVisitorsToday: 0, buttonClicksToday: 0, contactRequestsToday: 0, pageViewsWeek: 0, contactRequestsWeek: 0 },
    clicks: [],
    activity: [],
    bookings: [],
    settings: { domainExpiry: '', sslExpiry: '' }
  };
}
