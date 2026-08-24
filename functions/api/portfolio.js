import { getStore, json } from '../lib/admin.js';

const PROJECTS_KEY = 'portfolio:projects';

export async function onRequestGet({ env }) {
  const store = getStore(env);
  const projects = store ? await store.get(PROJECTS_KEY, { type: 'json' }) : null;
  return json({
    managed: Array.isArray(projects),
    projects: Array.isArray(projects) ? projects : []
  });
}
