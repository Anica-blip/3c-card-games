/**
 * 3C Card Games — Cloudflare Worker
 * ──────────────────────────────────────────────────
 *
 * Routes:
 *
 *   DECK JSON
 *   GET    /deck/:slug        → fetch deck.json from R2
 *   PUT    /deck/:slug        → save deck.json to R2
 *   DELETE /deck/:slug        → delete deck.json from R2
 *
 *   LANDING MEDIA
 *   PUT    /landing/:slug     → save landing image/video binary to R2
 *                               stored at: CardGames/{slug}/landing.{ext}
 *
 * R2 key conventions:
 *   CardGames/{slug}/deck.json
 *   CardGames/{slug}/landing.{ext}    ← via /landing/:slug
 *   CardGames/{slug}/intro.{ext}      ← via /media/:slug/:filename
 *   CardGames/{slug}/finale.{ext}     ← via /media/:slug/:filename
 *   CardGames/{slug}/card-01-front.{ext} ← via /media/:slug/:filename
 *   CardGames/{slug}/card-01-back.{ext}  ← via /media/:slug/:filename
 *
 * R2 binding name: CARD_GAMES_BUCKET
 * (wrangler.toml → r2_buckets → binding = "CARD_GAMES_BUCKET")
 */

const ALLOWED_ORIGINS = [
  'https://anica-blip.github.io',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:3000',
];

/* ── CORS headers ─────────────────────────────────── */
function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-File-Extension',
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

/* ── MIME type map ────────────────────────────────── */
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

function getMimeType(ext) {
  return MIME_TYPES[ext.toLowerCase()] || 'application/octet-stream';
}

/* ── Main fetch handler ───────────────────────────── */
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const method = request.method.toUpperCase();
    const url    = new URL(request.url);

    /* ── CORS preflight ─────────────────────────── */
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin),
      });
    }

    /* ── Route: /deck/:slug ─────────────────────── */
    const deckMatch = url.pathname.match(/^\/deck\/([a-z0-9.\-]+)$/i);
    if (deckMatch) {
      const slug  = deckMatch[1];
      const r2Key = `CardGames/${slug}/deck.json`;

      /* GET /deck/:slug */
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

      /* PUT /deck/:slug */
      if (method === 'PUT') {
        try {
          const body = await request.text();
          JSON.parse(body); // validate JSON before storing
          await env.CARD_GAMES_BUCKET.put(r2Key, body, {
            httpMetadata: { contentType: 'application/json' },
          });
          return respond(
            JSON.stringify({ ok: true, r2_key: r2Key }),
            200, origin
          );
        } catch (err) {
          const isJsonErr = err instanceof SyntaxError;
          return respond(
            JSON.stringify({
              error:  isJsonErr ? 'Invalid JSON body' : 'R2 write failed',
              detail: err.message,
            }),
            isJsonErr ? 400 : 500,
            origin
          );
        }
      }

      /* DELETE /deck/:slug */
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

      return respond(
        JSON.stringify({ error: 'Method not allowed' }),
        405, origin
      );
    }

    /* ── Route: /landing/:slug ──────────────────── */
    /*
      PUT /landing/:slug
        Accepts a binary image or video file.
        File extension is passed via the
        X-File-Extension request header.
        Stored at: CardGames/{slug}/landing.{ext}
        Returns:   { ok, r2_key, public_url }
    */
    const landingMatch = url.pathname.match(/^\/landing\/([a-z0-9.\-]+)$/i);
    if (landingMatch) {
      const slug = landingMatch[1];

      if (method !== 'PUT') {
        return respond(
          JSON.stringify({ error: 'Only PUT is supported on /landing/:slug' }),
          405, origin
        );
      }

      try {
        // Get file extension from header (sent by admin)
        const ext = (request.headers.get('X-File-Extension') || 'png')
          .toLowerCase()
          .replace(/^\./, ''); // strip leading dot if present

        const r2Key      = `CardGames/${slug}/landing.${ext}`;
        const mimeType   = getMimeType(ext);
        const publicUrl  = `https://files.3c-public-library.org/${r2Key}`;

        // Read binary body
        const arrayBuffer = await request.arrayBuffer();

        if (arrayBuffer.byteLength === 0) {
          return respond(
            JSON.stringify({ error: 'Empty file body' }),
            400, origin
          );
        }

        // Store binary in R2
        await env.CARD_GAMES_BUCKET.put(r2Key, arrayBuffer, {
          httpMetadata: { contentType: mimeType },
        });

        return respond(
          JSON.stringify({
            ok:         true,
            r2_key:     r2Key,
            public_url: publicUrl,
          }),
          200, origin
        );

      } catch (err) {
        return respond(
          JSON.stringify({ error: 'Landing upload failed', detail: err.message }),
          500, origin
        );
      }
    }

    /* ── Route: /media/:slug/:filename ─────────────
      PUT /media/:slug/:filename
        Accepts any image or video binary.
        Supports: png, jpg, jpeg, gif, webp,
                  mp4, webm, mov, ogg
        Stored at: CardGames/{slug}/{filename}
        Returns:   { ok, r2_key, public_url }

        Used by admin for:
          intro, finale, card fronts, card backs
    */
    const mediaMatch = url.pathname.match(
      /^\/media\/([a-z0-9.\-]+)\/(.+)$/i
    );
    if (mediaMatch) {
      const slug     = mediaMatch[1];
      const filename = decodeURIComponent(mediaMatch[2]);

      if (method !== 'PUT') {
        return respond(
          JSON.stringify({ error: 'Only PUT is supported on /media/:slug/:filename' }),
          405, origin
        );
      }

      try {
        const ext      = filename.split('.').pop().toLowerCase();
        const mimeType = getMimeType(ext);
        const r2Key    = `CardGames/${slug}/${filename}`;
        const publicUrl = `https://files.3c-public-library.org/${r2Key}`;

        const arrayBuffer = await request.arrayBuffer();

        if (arrayBuffer.byteLength === 0) {
          return respond(
            JSON.stringify({ error: 'Empty file body' }),
            400, origin
          );
        }

        await env.CARD_GAMES_BUCKET.put(r2Key, arrayBuffer, {
          httpMetadata: { contentType: mimeType },
        });

        return respond(
          JSON.stringify({
            ok:         true,
            r2_key:     r2Key,
            public_url: publicUrl,
          }),
          200, origin
        );

      } catch (err) {
        return respond(
          JSON.stringify({ error: 'Media upload failed', detail: err.message }),
          500, origin
        );
      }
    }

    /* ── No route matched ───────────────────────── */
    return respond(
      JSON.stringify({
        error: 'Not found',
        routes: [
          'GET    /deck/:slug',
          'PUT    /deck/:slug',
          'DELETE /deck/:slug',
          'PUT    /landing/:slug',
          'PUT    /media/:slug/:filename',
        ],
      }),
      404, origin
    );
  },
};
