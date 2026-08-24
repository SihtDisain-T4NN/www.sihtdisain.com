import { cleanText, getStore, json, readJson, requireAdmin, sameOrigin } from '../../lib/admin.js';

const PROJECTS_KEY = 'portfolio:projects';
const CATEGORIES = {
  branding: 'Bränding',
  logo: 'Logo',
  packaging: 'Pakend',
  web: 'Veeb',
  uiux: 'UI / UX',
  campaign: 'Kampaania',
  graphic: 'Graafika'
};
const SIZES = new Set(['standard', 'hero', 'wide', 'portrait']);

export async function onRequestGet({ request, env }) {
  if (!await requireAdmin(request, env)) return json({ success: false, error: 'Sisselogimine on vajalik.' }, 401);
  const projects = await readProjects(getStore(env));
  return json({ success: true, projects: projects || [], managed: Boolean(projects) });
}

export async function onRequestPut({ request, env }) {
  if (!sameOrigin(request)) return json({ success: false, error: 'Vigane päring.' }, 403);
  if (!await requireAdmin(request, env)) return json({ success: false, error: 'Sisselogimine on vajalik.' }, 401);

  const payload = await readJson(request);
  const projects = Array.isArray(payload?.projects) ? validateProjects(payload.projects) : null;
  if (!projects) return json({ success: false, error: 'Kontrolli projekti välju ja pilte.' }, 400);

  const store = getStore(env);
  await store.put(PROJECTS_KEY, JSON.stringify(projects));
  return json({ success: true, projects, managed: true });
}

export { PROJECTS_KEY };

async function readProjects(store) {
  if (!store) return null;
  const projects = await store.get(PROJECTS_KEY, { type: 'json' });
  return Array.isArray(projects) ? projects : null;
}

function validateProjects(items) {
  if (items.length > 80) return null;
  const ids = new Set();
  const projects = [];

  for (const item of items) {
    if (!item || typeof item !== 'object') return null;
    const id = cleanText(String(item.id || ''), 80);
    const title = cleanText(item.title, 90);
    const category = cleanText(item.category, 30);
    const year = cleanText(item.year, 4);
    const description = cleanText(item.description, 520);
    const seoTitle = cleanText(item.seoTitle, 70);
    const seoDescription = cleanText(item.seoDescription, 160);
    const image = cleanImage(item.image);
    const tags = normaliseTags(item.tags);
    const gallery = normaliseGallery(item.gallery);
    const caseStudy = normaliseCaseStudy(item.caseStudy);

    if (!/^[a-z0-9-]+$/i.test(id) || ids.has(id) || !title || !CATEGORIES[category] || !/^\d{4}$/.test(year) || description.length < 8 || !image || !tags || !gallery || !caseStudy) return null;
    ids.add(id);
    projects.push({
      id,
      title,
      category,
      categoryLabel: CATEGORIES[category],
      year,
      description,
      seoTitle,
      seoDescription,
      image,
      featured: Boolean(item.featured),
      size: SIZES.has(item.size) ? item.size : 'standard',
      tags,
      gallery,
      caseStudy
    });
  }

  return projects;
}

function normaliseTags(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 8) return null;
  const tags = value.map(tag => cleanText(tag, 40)).filter(Boolean);
  return tags.length === value.length ? tags : null;
}

function normaliseGallery(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 10) return null;
  const gallery = value.map(cleanImage);
  return gallery.every(Boolean) ? gallery : null;
}

function normaliseCaseStudy(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    challenge: cleanText(value.challenge, 1200),
    solution: cleanText(value.solution, 1200),
    result: cleanText(value.result, 1200)
  };
}

function cleanImage(value) {
  const source = cleanText(value, 500);
  if (!source) return '';
  return /^\/api\/media\/[a-z0-9-]+\.(?:jpe?g|png|webp)$/i.test(source)
    || /^\.\/assets\/projects\/[a-z0-9-]+\.(?:png|jpe?g|webp|svg)$/i.test(source)
    || /^https:\/\/[^\s]+$/i.test(source)
    ? source
    : '';
}
