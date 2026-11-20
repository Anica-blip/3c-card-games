/**
 * 3C Word Search — Cloudflare Worker
 * ─────────────────────────────────────────────────────────────
 * Built by Claude (Anthropic) × Chef Anica · 3C Thread To Success
 *
 * ROUTE TABLE
 *   PUBLIC — no sign-in, read only (the puzzle pages need this)
 *     GET    /puzzle/:slug             → fetch WordSearch/{slug}.json
 *   OWNER ONLY — Supabase GitHub sign-in, then rpc/is_owner must return true
 *     PUT    /puzzle/:slug             → save   WordSearch/{slug}.json
 *     DELETE /puzzle/:slug             → delete WordSearch/{slug}.json
 *     PUT    /landing/:slug            → save landing image/video
 *                                        (extension in the X-File-Extension header)
 *                                        stored at WordSearch/{slug}/landing.{ext}
 *     PUT    /media/:slug/:filename    → save background / intro / finale media
 *                                        stored at WordSearch/{slug}/{filename}
 *   Anything else: 404 (unknown address) or 405 (wrong method).
 *
 * LOGIN
 *   There is no login code in this Worker. The admin pages sign in with GitHub
 *   through Supabase (project "Aurion 3C Mascot") and send the sign-in token as
 *   "Authorization: Bearer <token>". The Worker asks Supabase's is_owner()
 *   function whether that token belongs to the owner. Only "true" passes.
 *   Signing in alone is never enough. If the check cannot be made, the Worker
 *   refuses (fails closed). No secrets and no variables are needed here: the
 *   Supabase address and the anon key below are public by design.
 *
 * STORAGE
 *   R2 binding WORDSEARCH_BUCKET → bucket 3c-library-files, folder WordSearch/
 *   Allowed media: png, jpg, jpeg, gif, webp, mp4, webm, mov, ogg
 *
 * DEPLOY
 *   Pasted into the Cloudflare dashboard editor (never Wrangler: a Wrangler
 *   deploy would overwrite what was pasted).
 */

const SUPABASE_URL      = 'https://cgxjqsbrditbteqhdyus.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneGpxc2JyZGl0YnRlcWhkeXVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTExMTY1ODEsImV4cCI6MjA2NjY5MjU4MX0.xUDy5ic-r52kmRtocdcW8Np9-lczjMZ6YKPXc03rIG4';

// Websites allowed to call the owner-only routes from a browser.
const ALLOWED_ORIGINS = ['https://anica-blip.github.io'];

const PUBLIC_BASE = 'https://files.3c-public-library.org/';

// Limits
const MAX_JSON_BYTES   = 1000000;            // one puzzle file
const MAX_UPLOAD_BYTES = 90 * 1024 * 1024;   // one media file

/* ── MIME type map (also the list of allowed upload types) ── */
const MIME_TYPES = {
  png:  'image/png',
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  gif:  'image/gif',
  webp: 'image/webp',
  mp4:  'video/mp4',
  webm: 'video/webm',
  mov:  'video/quicktime',
  ogg:  'video/ogg',
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/* ── Main fetch handler ───────────────────────────── */
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const originAllowed = !!origin && ALLOWED_ORIGINS.includes(origin);

    // Browser pre-flight: only the allowed website gets an answer.
    if (request.method === 'OPTIONS') {
      if (!originAllowed) return new Response(null, { status: 403 });
      const res = new Response(null, { status: 204 });
      res.headers.set('Access-Control-Allow-Origin', origin);
      res.headers.append('Vary', 'Origin');
      res.headers.set('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
      res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-File-Extension');
      res.headers.set('Access-Control-Max-Age', '86400');
      return res;
    }

    let isPublic = true;
    let response;

    try {
      const url   = new URL(request.url);
      const route = matchRoute(url.pathname, request.method);
      isPublic = route.isPublic;

      if (!isPublic) {
        // A browser from any other website is refused before anything else.
        if (origin && !originAllowed) throw new HttpError(403, 'Origin not allowed');
        await requireOwner(request);
      }

      response = await route.run(request, env);
    } catch (err) {
      if (err instanceof HttpError) {
        response = json({ error: err.message }, err.status);
      } else {
        console.error('wordsearch error:', err && err.message ? err.message : err);
        response = json({ error: 'Server error' }, 500);
      }
    }

    return withCors(response, origin, originAllowed, isPublic);
  },
};

/* ── Routing ──────────────────────────────────────── */

function validSlug(slug) {
  return /^[a-z0-9][a-z0-9.\-]{0,63}$/i.test(slug) && !slug.includes('..');
}

function matchRoute(path, method) {
  const allow = (list) => {
    if (!list.includes(method)) throw new HttpError(405, 'Method not allowed');
  };

  let m = path.match(/^\/puzzle\/([^/]+)$/);
  if (m) {
    const slug = m[1];
    if (!validSlug(slug)) throw new HttpError(404, 'Not found');
    allow(['GET', 'PUT', 'DELETE']);
    if (method === 'GET')    return { isPublic: true,  run: (req, env) => getPuzzle(slug, env) };
    if (method === 'PUT')    return { isPublic: false, run: (req, env) => putPuzzle(slug, req, env) };
    return                          { isPublic: false, run: (req, env) => deletePuzzle(slug, env) };
  }

  m = path.match(/^\/landing\/([^/]+)$/);
  if (m) {
    const slug = m[1];
    if (!validSlug(slug)) throw new HttpError(404, 'Not found');
    allow(['PUT']);
    return { isPublic: false, run: (req, env) => putLanding(slug, req, env) };
  }

  m = path.match(/^\/media\/([^/]+)\/([^/]+)$/);
  if (m) {
    const slug = m[1];
    let filename;
    try { filename = decodeURIComponent(m[2]); } catch { throw new HttpError(404, 'Not found'); }
    if (!validSlug(slug)) throw new HttpError(404, 'Not found');
    allow(['PUT']);
    return { isPublic: false, run: (req, env) => putMedia(slug, filename, req, env) };
  }

  throw new HttpError(404, 'Not found');
}

/* ── Owner check (Supabase is_owner) ──────────────── */

async function requireOwner(request) {
  const header = request.headers.get('Authorization') || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) throw new HttpError(401, 'Sign in required');

  let res;
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_owner`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new HttpError(503, 'Sign-in check unavailable');
  }

  if (res.status === 401 || res.status === 403) throw new HttpError(401, 'Sign in required');
  if (!res.ok) throw new HttpError(503, 'Sign-in check unavailable');

  let answer;
  try { answer = await res.json(); } catch { throw new HttpError(503, 'Sign-in check unavailable'); }

  if (answer !== true) throw new HttpError(403, 'Not allowed');
}

/* ── Puzzle JSON ──────────────────────────────────── */

async function getPuzzle(slug, env) {
  const obj = await env.WORDSEARCH_BUCKET.get(`WordSearch/${slug}.json`);
  if (!obj) throw new HttpError(404, `Puzzle not found: ${slug}`);
  return new Response(await obj.text(), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function putPuzzle(slug, request, env) {
  const declared = parseInt(request.headers.get('Content-Length') || '0', 10);
  if (declared > MAX_JSON_BYTES) throw new HttpError(413, 'Request too large');

  const body = await request.text();
  if (body.length > MAX_JSON_BYTES) throw new HttpError(413, 'Request too large');

  let value;
  try { value = JSON.parse(body); } catch { throw new HttpError(400, 'Invalid JSON body'); }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, 'Invalid JSON body');
  }

  const r2Key = `WordSearch/${slug}.json`;
  await env.WORDSEARCH_BUCKET.put(r2Key, body, {
    httpMetadata: { contentType: 'application/json' },
  });
  return json({ ok: true, r2_key: r2Key });
}

async function deletePuzzle(slug, env) {
  const r2Key = `WordSearch/${slug}.json`;
  await env.WORDSEARCH_BUCKET.delete(r2Key);
  return json({ ok: true, deleted: r2Key });
}

/* ── Media uploads ────────────────────────────────── */

async function storeBinary(request, env, r2Key, ext) {
  const mimeType = MIME_TYPES[ext];
  if (!mimeType) {
    throw new HttpError(415, 'Allowed files: png, jpg, jpeg, gif, webp, mp4, webm, mov, ogg');
  }

  const declared = parseInt(request.headers.get('Content-Length') || '0', 10);
  if (declared > MAX_UPLOAD_BYTES) throw new HttpError(413, 'File too large');

  const buffer = await request.arrayBuffer();
  if (buffer.byteLength === 0) throw new HttpError(400, 'Empty file body');
  if (buffer.byteLength > MAX_UPLOAD_BYTES) throw new HttpError(413, 'File too large');

  await env.WORDSEARCH_BUCKET.put(r2Key, buffer, {
    httpMetadata: { contentType: mimeType },
  });

  return json({ ok: true, r2_key: r2Key, public_url: `${PUBLIC_BASE}${r2Key}` });
}

async function putLanding(slug, request, env) {
  const ext = (request.headers.get('X-File-Extension') || 'png')
    .toLowerCase()
    .replace(/^\./, '');
  return storeBinary(request, env, `WordSearch/${slug}/landing.${ext}`, ext);
}

async function putMedia(slug, filename, request, env) {
  if (!/^[A-Za-z0-9_-][A-Za-z0-9._-]{0,99}$/.test(filename) || filename.includes('..')) {
    throw new HttpError(400, 'Invalid file name');
  }
  const ext = filename.split('.').pop().toLowerCase();
  return storeBinary(request, env, `WordSearch/${slug}/${filename}`, ext);
}

/* ── CORS / JSON ──────────────────────────────────── */

// Puzzle reads are open to every website. Owner-only routes answer only the
// allowed website (and say so with Vary: Origin).
function withCors(response, origin, originAllowed, isPublic) {
  const res = new Response(response.body, response);
  if (isPublic) {
    res.headers.set('Access-Control-Allow-Origin', '*');
  } else if (originAllowed) {
    res.headers.set('Access-Control-Allow-Origin', origin);
    res.headers.append('Vary', 'Origin');
  }
  return res;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
