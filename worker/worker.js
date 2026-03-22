/**
 * 3C Card Games — Cloudflare Worker
 * ──────────────────────────────────
 * Handles R2 read / write / delete for deck JSON files.
 * Card images are uploaded directly via Cloudflare dashboard
 * or wrangler — this worker only manages deck.json files.
 *
 * Routes:
 *   GET    /deck/:slug   → fetch deck JSON from R2
 *   PUT    /deck/:slug   → save deck JSON to R2
 *   DELETE /deck/:slug   → remove deck JSON from R2
 *
 * R2 key pattern:
 *   CardGames/{slug}/deck.json
 *
 * Wrangler binding name: CARD_GAMES_BUCKET
 * (set in wrangler.toml → r2_buckets)
 */

const ALLOWED_ORIGINS = [
  'https://anica-blip.github.io',   // GitHub Pages (admin + public)
  'http://localhost:5500',           // Live Server local dev
  'http://127.0.0.1:5500',
  'http://localhost:3000',
];

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function respond(body, status, origin, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
      ...extraHeaders,
    },
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const method = request.method.toUpperCase();
    const url    = new URL(request.url);

    // ── CORS preflight ──────────────────────────────
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin),
      });
    }

    // ── Route: /deck/:slug ──────────────────────────
    const match = url.pathname.match(/^\/deck\/([a-z0-9\-]+)$/i);
    if (!match) {
      return respond(
        JSON.stringify({ error: 'Not found. Use /deck/:slug' }),
        404, origin
      );
    }

    const slug   = match[1];
    const r2Key  = `CardGames/${slug}/deck.json`;

    // ── GET ─────────────────────────────────────────
    if (method === 'GET') {
      try {
        const obj = await env.CARD_GAMES_BUCKET.get(r2Key);
        if (!obj) {
          return respond(
            JSON.stringify({ error: `Deck not found: ${slug}` }),
            404, origin
          );
        }
        const text = await obj.text();
        return respond(text, 200, origin);
      } catch (err) {
        return respond(
          JSON.stringify({ error: 'R2 read failed', detail: err.message }),
          500, origin
        );
      }
    }

    // ── PUT ─────────────────────────────────────────
    if (method === 'PUT') {
      try {
        const body = await request.text();

        // Validate it is valid JSON before storing
        JSON.parse(body);

        await env.CARD_GAMES_BUCKET.put(r2Key, body, {
          httpMetadata: { contentType: 'application/json' },
        });

        return respond(
          JSON.stringify({ ok: true, r2_key: r2Key }),
          200, origin
        );
      } catch (err) {
        const isJson = err instanceof SyntaxError;
        return respond(
          JSON.stringify({
            error: isJson ? 'Invalid JSON body' : 'R2 write failed',
            detail: err.message,
          }),
          isJson ? 400 : 500,
          origin
        );
      }
    }

    // ── DELETE ──────────────────────────────────────
    if (method === 'DELETE') {
      try {
        await env.CARD_GAMES_BUCKET.delete(r2Key);
        return respond(
          JSON.stringify({ ok: true, deleted: r2Key }),
          200, origin
        );
      } catch (err) {
        return respond(
          JSON.stringify({ error: 'R2 delete failed', detail: err.message }),
          500, origin
        );
      }
    }

    // ── Method not allowed ───────────────────────────
    return respond(
      JSON.stringify({ error: 'Method not allowed' }),
      405, origin
    );
  },
};
