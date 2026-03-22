# SETUP.md — 3C Card Games Architecture & Deployment Guide

> Living document. Update this file whenever the architecture changes.

---

## Table of Contents

1. [Overview](#overview)
2. [Repository Structure](#repository-structure)
3. [Tech Stack](#tech-stack)
4. [Flow Architecture](#flow-architecture)
5. [JSON Structure](#json-structure)
6. [Cloudflare R2 — File Conventions](#cloudflare-r2--file-conventions)
7. [Supabase — Table & RLS](#supabase--table--rls)
8. [Cloudflare Worker — Routes](#cloudflare-worker--routes)
9. [Deployment Steps](#deployment-steps)
10. [Admin Workflow](#admin-workflow)
11. [Public User Flow](#public-user-flow)
12. [Adding a New Deck](#adding-a-new-deck)

---

## Overview

3C Card Games is a modular card game platform for 3C Thread To Success.
Each deck is self-contained: one JSON file in Cloudflare R2 drives the
entire public game experience. The admin panel manages decks without
touching any code.

**Prototype deck:** Aurion's Lucky Wisdom Deck

---

## Repository Structure

```
3c-card-games/
│
├── index.html                  ← Root redirect → admin/index.html
├── landing.html                ← Public shared URL per deck
├── README.md
├── SETUP.md                    ← This file
├── LICENSE
│
├── public/
│   └── index.html              ← Full card game app (5 screens)
│
├── admin/
│   ├── index.html              ← Deck editor (create, edit, save decks)
│   ├── admin.app.js            ← Admin logic (Supabase + Worker calls)
│   ├── admin.css               ← Admin styles
│   └── landing-upload.html     ← Standalone landing image/video uploader
│
└── worker/
    ├── worker.js               ← Cloudflare Worker (R2 read/write/delete)
    └── wrangler.toml           ← Worker deployment config
```

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Vanilla HTML / CSS / JS | Zero dependencies, fast load |
| Fonts | Google Fonts (Cinzel + Lato) | Branding |
| Database | Supabase (PostgreSQL) | Deck index + metadata |
| File Storage | Cloudflare R2 | Deck JSON + landing media |
| Worker | Cloudflare Worker | R2 write/read/delete API |
| Hosting | GitHub Pages | Public + Admin delivery |

---

## Flow Architecture

```
┌─────────────────────────────────────────────────────┐
│                     ADMIN SIDE                      │
│                                                     │
│  admin/index.html                                   │
│    → Create / edit deck                             │
│    → Upload card images from computer (preview only)│
│    → Save Deck                                      │
│        → PUT /deck/:slug → Worker → R2 (JSON)       │
│        → Upsert Supabase index row                  │
│                                                     │
│  admin/landing-upload.html                          │
│    → Pick saved deck from Supabase dropdown         │
│    → Upload landing image/video from computer       │
│        → PUT /landing/:slug → Worker → R2 (binary)  │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│                    PUBLIC SIDE                      │
│                                                     │
│  landing.html?deck=deck.01                          │
│    → Fetches CardGames/deck.01/deck.json from R2    │
│    → Loads landing.{ext} from R2                   │
│    → User clicks ENTER                              │
│        → public/index.html?deck=deck.01             │
│                                                     │
│  public/index.html?deck=deck.01                     │
│    → Fetches deck.json ONCE → stored in memory      │
│    → Screen 1 (Intro)   → reads deck.intro only     │
│    → Screen 2 (Pick)    → reads deck.cards[].id     │
│    → Screen 3 (Card)    → reads deck.cards[n].front │
│    → Screen 4 (Flip)    → reads deck.cards[n].back  │
│    → Screen 5 (Finale)  → reads deck.finale only    │
└─────────────────────────────────────────────────────┘
```

---

## JSON Structure

One JSON file per deck. Stored at:
```
CardGames/{slug}/deck.json
```

```json
{
  "slug":   "deck.01",
  "title":  "Aurion's Lucky Wisdom Deck",
  "intro":  "https://files.3c-public-library.org/CardGames/deck.01/intro.png",
  "finale": "https://files.3c-public-library.org/CardGames/deck.01/finale.png",
  "cards": [
    {
      "id":    1,
      "front": "https://files.3c-public-library.org/CardGames/deck.01/card-01-front.png",
      "back":  "https://files.3c-public-library.org/CardGames/deck.01/card-01-back.png"
    },
    {
      "id":    2,
      "front": "https://files.3c-public-library.org/CardGames/deck.01/card-02-front.png",
      "back":  "https://files.3c-public-library.org/CardGames/deck.01/card-02-back.png"
    }
  ]
}
```

**Key rules:**
- `intro` and `finale` can be `.png`, `.jpg`, `.mp4`, `.webm` — both image and video supported
- `cards` array is flexible — add as many or as few cards as needed
- Card filenames follow strict convention: `card-{nn}-front.{ext}` and `card-{nn}-back.{ext}`
- Landing media is stored separately — NOT inside the JSON

---

## Cloudflare R2 — File Conventions

**Bucket:** `3c-library-files`
**Public base URL:** `https://files.3c-public-library.org`

```
3c-library-files/
└── CardGames/
    ├── logo.png                        ← Shared 3C logo (pick screen)
    ├── og-preview.png                  ← Open Graph social share image
    └── deck.01/
        ├── deck.json                   ← Saved by worker on Save Deck
        ├── landing.{ext}               ← Saved by worker via landing-upload.html
        ├── intro.{ext}                 ← URL stored in deck.json (loaded from computer in admin)
        ├── finale.{ext}                ← URL stored in deck.json (loaded from computer in admin)
        ├── card-01-front.{ext}         ← URL stored in deck.json (loaded from computer in admin)
        ├── card-01-back.{ext}
        ├── card-02-front.{ext}
        ├── card-02-back.{ext}
        └── ...
```

**How media gets into R2 — the correct flow:**
- All media (intro, finale, card front, card back) is loaded from
  **Chef's computer** in the admin panel for local preview only
- On **Save Deck** → filenames are auto-constructed into R2 public URLs
  and stored inside the ONE deck JSON file → pushed to R2 via worker
- **Landing image/video** is the only file sent directly to R2 —
  uploaded from computer in `landing-upload.html` → worker stores it
- The public app reads all URLs from the JSON — it never discovers files

---

## Supabase — Table & RLS

**Table:** `card_decks`

```sql
create table card_decks (
  id          bigint generated always as identity primary key,
  deck_slug   text unique not null,
  title       text,
  r2_key      text,
  deck_url    text,
  card_count  int4 default 0,
  created_at  timestamptz default now()
);
```

**RLS Policies (anon key access):**

```sql
alter table card_decks enable row level security;

create policy "anon can read card_decks"
  on card_decks for select to anon using (true);

create policy "anon can insert card_decks"
  on card_decks for insert to anon with check (true);

create policy "anon can update card_decks"
  on card_decks for update to anon
  using (true) with check (true);

create policy "anon can delete card_decks"
  on card_decks for delete to anon using (true);
```

**Supabase project:** `cgxjqsbrditbteqhdyus.supabase.co`

---

## Cloudflare Worker — Routes

**Worker name:** `3c-card-games`
**Worker URL:** `https://3c-card-games.3c-innertherapy.workers.dev`
**R2 binding:** `CARD_GAMES_BUCKET` → `3c-library-files`

| Method | Route | Purpose |
|---|---|---|
| GET | `/deck/:slug` | Fetch deck JSON from R2 |
| PUT | `/deck/:slug` | Save deck JSON to R2 |
| DELETE | `/deck/:slug` | Delete deck JSON from R2 |
| PUT | `/landing/:slug` | Save landing image/video binary to R2 |

**Headers used:**
- `Content-Type: application/json` — for deck JSON
- `X-File-Extension: png` (or mp4, webm etc.) — for landing upload

---

## Deployment Steps

### 1. Supabase
- Project already live at `cgxjqsbrditbteqhdyus.supabase.co`
- Table `card_decks` created with RLS policies ✅

### 2. Cloudflare Worker
```bash
cd worker
npx wrangler deploy
```
- Binding: `CARD_GAMES_BUCKET` → `3c-library-files` (set in Cloudflare dashboard)
- No secret environment variables required

### 3. GitHub Pages
- Repository: `anica-blip/3c-card-games`
- Pages source: `main` branch, root `/`
- Root `index.html` redirects to `admin/index.html`

**Live URLs:**
```
Root (admin):   https://anica-blip.github.io/3c-card-games/
Admin:          https://anica-blip.github.io/3c-card-games/admin/index.html
Landing upload: https://anica-blip.github.io/3c-card-games/admin/landing-upload.html
Public game:    https://anica-blip.github.io/3c-card-games/public/index.html?deck={slug}
Shared URL:     https://anica-blip.github.io/3c-card-games/landing.html?deck={slug}
```

---

## Admin Workflow

```
1. Open admin/index.html
2. Click New Deck → auto-generates deck.01, deck.02 etc.
3. Enter Deck Title
4. Add Cards → + Add Card (repeat for each card)
   - Upload Front image from computer → local preview
   - Upload Back image from computer  → local preview
   - Reorder with ▲ ▼ | Remove with ✕
5. Click Save Deck
   → JSON pushed to R2 via worker
   → Supabase index row created
   → Deck URL generated (copy + share)
6. Open admin/landing-upload.html
   → Select deck from dropdown
   → Upload landing image or video from computer
   → Sent directly to R2 via worker
```

---

## Public User Flow

```
1. User receives shared URL:
   https://anica-blip.github.io/3c-card-games/landing.html?deck=deck.01

2. landing.html
   → Fetches deck.json → gets landing media URL
   → Loads landing image or video (9:16 portrait)
   → User clicks ENTER

3. public/index.html?deck=deck.01
   → Fetches deck.json ONCE, stores in memory

4. Intro screen    → deck.intro media loads
   LET'S START →

5. Pick screen     → number buttons built from deck.cards
   User picks number →

6. Card front      → deck.cards[n].front loads
   User taps card →

7. Card flips      → deck.cards[n].back loads
   NEXT →

8. Finale screen   → deck.finale media loads
   START AGAIN or CLOSE
```

---

## Adding a New Deck

1. Open `admin/index.html` → New Deck → builds `deck.02` automatically
2. Add title, add cards, upload previews, Save Deck
3. Open `admin/landing-upload.html` → select `deck.02` → upload landing media
4. Share the generated URL: `landing.html?deck=deck.02`
5. Each deck is completely independent — no code changes ever needed

---

*Architecture designed and documented by Claude · Built for Chef Anica · 3C Thread To Success*
