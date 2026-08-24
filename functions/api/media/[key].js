export async function onRequestGet({ params, env }) {
  if (!env.PORTFOLIO_MEDIA || !/^[a-z0-9-]+\.(?:jpe?g|png|webp)$/i.test(params.key || '')) {
    return new Response('Not found', { status: 404 });
  }

  const object = await env.PORTFOLIO_MEDIA.get(`portfolio/${params.key}`);
  if (!object) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('X-Content-Type-Options', 'nosniff');
  return new Response(object.body, { headers });
}
