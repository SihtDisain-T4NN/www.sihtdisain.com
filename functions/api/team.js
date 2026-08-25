import { cleanText, getStore, json } from '../lib/admin.js';

export const TEAM_KEY = 'studio:team';

export const DEFAULT_TEAM = [
  { id: 'taaniel-ormak', name: 'Taaniel Ormak', role: 'Asutaja & loovjuht', intro: 'Paneb paika suuna, hoiab tervikut ja aitab ideel saada selgeks brändiks.', image: '' },
  { id: 'andreas-henri', name: 'Andreas Henri', role: 'Graafiline disainer', intro: 'Annab ideedele visuaalse rütmi, täpsuse ja eristuva karakteri.', image: '' },
  { id: 'kaur', name: 'Kaur', role: 'Graafiline disainer', intro: 'Toob süsteemi, detaili ja läbimõeldud visuaalse korra igasse puudutusse.', image: '' },
  { id: 'robi', name: 'Robi', role: 'Graafiline disainer', intro: 'Leiutab värskeid vaatenurki ning viib visuaalid kindla käega lõpuni.', image: '' }
];

export async function onRequestGet({ env }) {
  const members = await readTeam(getStore(env));
  return json({ success: true, managed: Array.isArray(members), members: members || DEFAULT_TEAM });
}

export async function readTeam(store) {
  if (!store) return null;
  const members = await store.get(TEAM_KEY, { type: 'json' });
  return Array.isArray(members) ? members : null;
}

export function validateTeam(items) {
  if (!Array.isArray(items) || items.length > 30) return null;
  const ids = new Set();
  const members = [];

  for (const item of items) {
    if (!item || typeof item !== 'object') return null;
    const id = cleanText(String(item.id || ''), 80);
    const name = cleanText(item.name, 80);
    const role = cleanText(item.role, 90);
    const intro = cleanText(item.intro, 500);
    const rawImage = cleanText(item.image, 500);
    const image = cleanImage(rawImage);
    if (!/^[a-z0-9-]+$/i.test(id) || ids.has(id) || name.length < 2 || role.length < 2 || intro.length < 8 || (rawImage && !image)) return null;
    ids.add(id);
    members.push({ id, name, role, intro, image });
  }
  return members;
}

export function cleanImage(value) {
  const source = cleanText(value, 500);
  if (!source) return '';
  return /^\/api\/media\/[a-z0-9-]+\.(?:jpe?g|png|webp)$/i.test(source) || /^https:\/\/[^\s]+$/i.test(source) ? source : '';
}
