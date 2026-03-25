# 🃏 3C Card Games

**Aurion's Lucky Wisdom Deck** — a modular card game platform built for
[3C Thread To Success](https://3c-public-library.org).

Players pick a number, reveal their card, flip it to receive a wisdom message.
Fully manageable via the admin panel — no code changes needed to create or
update decks.

---

## Live URLs

| Page | URL |
|---|---|
| Admin Panel | [admin/index.html](https://3c-card-games.vercel.app/admin/index.html) |
| Landing Upload | [admin/landing-upload.html](https://3c-card-games.vercel.app/admin/landing-upload.html) |
| Public Game | `landing.html?deck={slug}` |

---

## How It Works

```
Admin creates deck → saves ONE JSON to Cloudflare R2
Shared URL → landing.html?deck=deck.01
  → loads landing media from R2
  → ENTER → public game app
  → fetches JSON once → each screen reads only its section
  → Pick → Card Front → Flip → Card Back → Finale
```

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML / CSS / JS |
| Database | Supabase (deck index) |
| File Storage | Cloudflare R2 (JSON + landing media) |
| Worker | Cloudflare Worker (R2 write API) |
| Hosting | GitHub Pages |

---

## Repository Structure

```
3c-card-games/
├── index.html                  ← Redirects to admin
├── landing.html                ← Public shared URL per deck
├── public/
│   └── index.html              ← Full card game (5 screens)
├── admin/
│   ├── index.html              ← Deck editor
│   ├── admin.app.js
│   ├── admin.css
│   └── landing-upload.html     ← Landing media uploader
└── worker/
    ├── worker.js               ← Cloudflare Worker
    └── wrangler.toml
```

---

## Setup & Architecture

See [`SETUP.md`](./SETUP.md) for full deployment instructions,
R2 file conventions, Supabase schema, Worker routes, and workflow guides.

---

## Adding a New Deck

1. Open Admin Panel → **New Deck**
2. Add title + cards (upload front & back images from computer)
3. **Save Deck** → JSON pushed to R2, URL generated
4. Open **Landing Upload** → select deck → upload landing image or video
5. Share the generated URL — done ✅

---

*Designed and created by [Claude](https://claude.ai) · Built for Chef Anica · 3C Thread To Success*
