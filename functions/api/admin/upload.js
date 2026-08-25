import { json, requireAdmin, sameOrigin } from '../../lib/admin.js';
import { logActivity } from '../../lib/insights.js';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp']
]);

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ success: false, error: 'Vigane päring.' }, 403);
  if (!await requireAdmin(request, env)) return json({ success: false, error: 'Sisselogimine on vajalik.' }, 401);
  if (!env.PORTFOLIO_MEDIA) return json({ success: false, error: 'Pildisalvestus pole veel seadistatud.' }, 503);

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES + 64 * 1024) {
    return json({ success: false, error: 'Pilt on liiga suur. Maksimum on 10 MB.' }, 413);
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ success: false, error: 'Pilti ei õnnestunud lugeda.' }, 400);
  }

  const file = form.get('image');
  if (!isImage(file) || !IMAGE_TYPES.has(file.type) || file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    return json({ success: false, error: 'Kasuta JPG, PNG või WEBP pilti (kuni 10 MB).' }, 400);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!hasExpectedSignature(file.type, bytes)) return json({ success: false, error: 'Pildifail ei ole kehtiv.' }, 400);

  const extension = IMAGE_TYPES.get(file.type);
  const filename = `${crypto.randomUUID()}.${extension}`;
  await env.PORTFOLIO_MEDIA.put(`portfolio/${filename}`, bytes, {
    httpMetadata: { contentType: file.type, cacheControl: 'public, max-age=31536000, immutable' },
    customMetadata: { originalName: cleanFilename(file.name) }
  });

  try {
    await logActivity(env, {
      type: 'media_uploaded',
      actor: 'Omanik',
      message: `Uus pilt lisati: ${cleanFilename(file.name)}`,
      meta: { file: cleanFilename(file.name) }
    });
  } catch (error) {
    console.warn('Portfolio upload activity log failed:', error);
  }

  return json({ success: true, url: `/api/media/${filename}` });
}

function isImage(value) {
  return value && typeof value === 'object' && typeof value.arrayBuffer === 'function' && typeof value.name === 'string';
}

function cleanFilename(filename) {
  return filename.replace(/[\\/:*?"<>|\u0000-\u001F\u007F]/g, '-').trim().slice(0, 120) || 'image';
}

function hasExpectedSignature(type, bytes) {
  if (type === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;
  if (type === 'image/png') return bytes.length >= 8 && bytes.slice(0, 8).every((byte, index) => byte === [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A][index]);
  if (type === 'image/webp') return bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  return false;
}
