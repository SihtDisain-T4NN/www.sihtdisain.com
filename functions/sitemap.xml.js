import { getStore } from './lib/admin.js';

const SITE = 'https://www.sihtdisain.ee';

export async function onRequestGet({ env }) {
  const urls = [
    { loc: `${SITE}/`, priority: '1.0' },
    { loc: `${SITE}/portfolio.html`, priority: '0.9' },
    { loc: `${SITE}/team.html`, priority: '0.7' }
  ];
  const store = getStore(env);
  const projects = store ? await store.get('portfolio:projects', { type: 'json' }) : null;
  if (Array.isArray(projects)) {
    projects.forEach(project => urls.push({ loc: `${SITE}/project.html?id=${encodeURIComponent(project.id)}`, priority: '0.7' }));
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(url => `  <url><loc>${escapeXml(url.loc)}</loc><changefreq>weekly</changefreq><priority>${url.priority}</priority></url>`).join('\n')}\n</urlset>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=UTF-8', 'Cache-Control': 'public, max-age=3600' } });
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]);
}
