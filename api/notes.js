// Stage 2: fictional training data only. Authentication is added in stage 3.
export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    return;
  }
  const endpoint = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!/^https:\/\/[a-z0-9]{20}\.supabase\.co\/?$/u.test(endpoint || '') || !secret) {
    response.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    return;
  }
  try {
    const url = new URL('/rest/v1/vault_notes', endpoint);
    url.searchParams.set('select', 'title,content');
    url.searchParams.set('order', 'position.asc');
    url.searchParams.set('limit', '100');
    const headers = { apikey: secret, Accept: 'application/json' };
    // New secret keys are API gateway keys, not JWT bearer tokens.
    if (!secret.startsWith('sb_secret_')) headers.Authorization = `Bearer ${secret}`;
    const upstream = await fetch(url, { headers, redirect: 'error', signal: AbortSignal.timeout(8000) });
    if (!upstream.ok) throw new Error('DATABASE_UNAVAILABLE');
    const rows = await upstream.json();
    if (!Array.isArray(rows) || rows.length > 100 || rows.some(row =>
      !row || typeof row.title !== 'string' || typeof row.content !== 'string' ||
      row.title.length > 200 || row.content.length > 10000)) throw new Error('INVALID_DATABASE_RESPONSE');
    response.status(200).json({ notes: rows.map(({ title, content }) => ({ title, content })) });
  } catch {
    // Never return upstream bodies, URLs, headers, credentials, or exception text.
    response.status(502).json({ error: 'DATABASE_UNAVAILABLE' });
  }
}
