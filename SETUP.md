# SETUP.md — 3C Card Games Architecture & Deployment Guide

> Living document. Update this file whenever the architecture changes.
> Last updated: 20 Nov 2026 — owner-only sign-in (GitHub through Supabase), secured Worker, Wrangler deployment.

---

## Table of Contents

1. [Overview](#overview)
2. [Repository Structure](#repository-structure)
3. [Tech Stack](#tech-stack)
4. [Security Summary](#security-summary)
5. [Flow Architecture](#flow-architecture)
6. [JSON Structure](#json-structure)
7. [Cloudflare R2 — File Conventions](#cloudflare-r2--file-conventions)
8. [Supabase — Table, RLS & Sign-in](#supabase--table-rls--sign-in)
9. [Cloudflare Worker — Routes](#cloudflare-worker--routes)
10. [Deployment Steps](#deployment-steps)
11. [Admin Workflow](#admin-workflow)
12. [Public User Flow](#public-user-flow)
13. [Adding a New Deck](#adding-a-new-deck)

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
├── LEGAL_DISCLAIMER.md
│
├── public/
│   └── index.html              ← Full card game app (5 screens)
│
├── admin/
│   ├── login.html              ← "Sign in with GitHub" page
│   ├── auth.js                 ← Sign-in + owner check, used by every admin page
│   ├── config.js               ← Supabase address + public anon key
│   ├── supabaseAPI.js          ← Supabase calls + authHeaders() (adds the sign-in token)
│   ├── index.html              ← Deck editor (create, edit, save decks)
│   ├── admin.app.js            ← Admin logic (Supabase + Worker calls)
│   ├── admin.css               ← Admin styles
│   ├── landing-upload.html     ← Standalone landing image/video uploader
│   └── signout.js              ← Not used by any page (leftover)
│
└── worker/
    ├── worker.js               ← Cloudflare Worker (R2 read/write/delete + owner check)
    └── wrangler.toml           ← Worker deployment config
```

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Vanilla HTML / CSS / JS | Zero build step, fast load |
| Fonts | Google Fonts (Cinzel + Lato) | Branding |
| Sign-in | Supabase Auth, GitHub provider (PKCE) | Owner-only admin access |
| Database | Supabase (PostgreSQL) | Deck index + metadata |
| File Storage | Cloudflare R2 | Deck JSON + landing media + card images |
| Worker | Cloudflare Worker | R2 read / write / delete API, owner-checked |
| Hosting | GitHub Pages | Public + Admin delivery |

---

## Security Summary

| Part | Who can do what |
|---|---|
| Public game (`landing.html`, `public/index.html`) | Anyone can play. They only read `GET /deck/:slug`. |
| Admin pages | Hidden until the owner is signed in with GitHub through Supabase. A signed-in account that is not the owner is signed out with a notice. |
| Worker write routes (save, delete, upload) | Owner only. Every call must carry the sign-in token; the Worker asks Supabase's `is_owner()` function and refuses anything but `true` (401 no/invalid sign-in, 403 not the owner, 503 if the check cannot be made). |
| Worker origin | Owner routes are refused for any website other than `https://anica-blip.github.io`. |
| Supabase table `card_decks` | Public read; writes only by the owner (see below). |
| Secrets | None. The Worker has no variables and no secrets; the Supabase address and anon key are public by design. |

Sessions refresh themselves. There is no fixed-length session and no lock-out after a set number of days.

---

## Flow Architecture

```
┌─────────────────────────────────────────────────────┐
│                     ADMIN SIDE                      │
│                                                     │
│  admin/login.html → GitHub sign-in (Supabase)       │
│    → owner check (is_owner) → admin opens           │
│                                                     │
│  admin/index.html                                   │
│    → Create / edit deck                             │
│    → Pick a card/intro/finale image from computer   │
│        → at once: PUT /media/:slug/:filename        │
│          → Worker → R2 (preview stays local)        │
│    → Save Deck                                      │
│        → PUT /deck/:slug → Worker → R2 (JSON)       │
│        → Upsert Supabase index row                  │
│    → Every Worker call sends the sign-in token      │
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
│    → GET /deck/deck.01 → Worker → R2 (deck.json)    │
│    → Loads landing.{ext} from R2                    │
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
- The JSON body sent to the Worker must be a JSON object, up to 1 MB

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
        ├── intro.{ext}                 ← Saved by worker (PUT /media) when the file is picked
        ├── finale.{ext}                ← Saved by worker (PUT /media) when the file is picked
        ├── card-01-front.{ext}         ← Saved by worker (PUT /media) when the file is picked
        ├── card-01-back.{ext}
        ├── card-02-front.{ext}
        ├── card-02-back.{ext}
        └── ...
```

**How media gets into R2 — the correct flow:**
- All media (intro, finale, card front, card back) is picked from
  **Chef's computer** in the admin panel. The moment a file is picked it is sent
  to R2 through the Worker (`PUT /media/:slug/:filename`); the admin keeps a
  local copy for the preview
- On **Save Deck** → the R2 public URLs of those files are stored inside the
  ONE deck JSON file → pushed to R2 via the Worker
- **Landing image/video** is uploaded from the computer in `landing-upload.html`
  → the Worker stores it as `landing.{ext}`
- The public app reads all URLs from the JSON — it never discovers files
- Every one of these uploads needs the owner's sign-in token

**Upload limits (enforced by the Worker):**
- Allowed types: png, jpg, jpeg, gif, webp, mp4, webm, mov, ogg (anything else: 415)
- Maximum size: 90 MB per file; empty files are refused
- Deck slugs and file names must be safe names (letters, numbers, dot, dash, underscore); anything else is refused

---

## Supabase — Table, RLS & Sign-in

**Supabase project:** "Aurion 3C Mascot" — `cgxjqsbrditbteqhdyus.supabase.co`
(shared with the library, quiz, notice board and word search)

**Table:** `card_decks`

```sql
create table card_decks (
  id          bigint generated always as identity primary key,
  deck_slug   text unique not null,
  title       text,
  r2_key      text,
  deck_url    text,
  card_count  int4 default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
```

**RLS (row level security is ON). Live policies:**

| Policy | Applies to | Rule |
|---|---|---|
| `anon can read card_decks` | visitors (anon), SELECT | everyone can read the deck list |
| `authenticated can read card_decks` | signed-in users, SELECT | everyone can read |
| `card_decks_owner_write` | signed-in users, ALL (insert, update, delete) | only the owner's account (the policy compares the signed-in account's email with the owner's email; the address is kept out of this public file) |

There is no public insert, update or delete.

**Sign-in settings (Supabase → Authentication):**
- **Providers:** GitHub enabled.
- **URL Configuration → Redirect URLs:** must include `https://anica-blip.github.io/3c-card-games/**`
- **Sessions:** "Time-box user sessions" and "Inactivity timeout" must stay **empty**, otherwise they bring back a fixed lock-out.

**How the admin signs in (`admin/auth.js`):**
- GitHub through Supabase (PKCE), own storage name `sb-3c-card-games-login` (all of Chef's GitHub Pages apps share one address, so each app needs its own name).
- Every admin page (login, deck editor, landing upload) is hidden until the owner check passes.
- No session → sent to `login.html`. Signed in but not the owner → signed out with a notice. If the owner check cannot be made (for example no network), nobody is signed out.
- After GitHub, the return address is `https://anica-blip.github.io/3c-card-games/admin/`.

---

## Cloudflare Worker — Routes

**Worker name:** `3c-card-games`
**Worker URL:** `https://3c-card-games.3c-innertherapy.workers.dev`
**R2 binding:** `CARD_GAMES_BUCKET` → `3c-library-files`
**Variables / secrets:** none

| Method | Route | Who | Purpose |
|---|---|---|---|
| GET | `/deck/:slug` | Public | Fetch deck JSON from R2 |
| PUT | `/deck/:slug` | Owner only | Save deck JSON to R2 |
| DELETE | `/deck/:slug` | Owner only | Delete deck JSON from R2 |
| PUT | `/landing/:slug` | Owner only | Save landing image/video binary to R2 |
| PUT | `/media/:slug/:filename` | Owner only | Save intro / finale / card front / card back |

**Headers used:**
- `Authorization: Bearer <token>` — every owner route
- `Content-Type: application/json` — for deck JSON
- `X-File-Extension: png` (or mp4, webm etc.) — for landing upload

**Answers:** 401 no/invalid sign-in · 403 not the owner or wrong website · 404 unknown address or missing deck · 405 wrong method · 415 file type not allowed · 503 owner check unavailable · generic "Server error" for anything unexpected (details go to the Worker log, never to the visitor).

---

## Deployment Steps

### 1. Supabase
- Project already live: "Aurion 3C Mascot" (`cgxjqsbrditbteqhdyus`)
- Table `card_decks` with RLS and the policies above ✅
- GitHub provider on, redirect URL `https://anica-blip.github.io/3c-card-games/**` added ✅

### 2. Cloudflare Worker — Wrangler only
This Worker is deployed with **Wrangler, from a deploy folder** that holds
`worker.js` and `wrangler.toml` side by side (copies of the repo's `worker/` folder).
**Never paste the code into the Cloudflare dashboard**: a Wrangler deploy replaces the
Worker's code, variables and bindings with what is in `wrangler.toml`, and mixing the
two methods stopped the Worker's reads working once (20 Nov 2026).

```bash
cd ~/3c-deploy/3c-card-games
ls
npx wrangler deploy
```

- `ls` must show `worker.js` and `wrangler.toml`.
- Binding `CARD_GAMES_BUCKET` → `3c-library-files` is set by `wrangler.toml`.
- No secrets and no variables are needed.
- To check how a Worker was deployed, open Cloudflare → Workers & Pages → the Worker → **Deployments**
  and read the coloured badge next to each version: **Wrangler** or **Dashboard**.
  (The italic words "Manually deployed" appear for both and say nothing about the method.)
- After a deploy, an unsigned `DELETE` on a name that does not exist must answer **401**:
  in the browser Console, `fetch('https://3c-card-games.3c-innertherapy.workers.dev/deck/zz-check',{method:'DELETE'}).then(r=>console.log(r.status))`

### 3. GitHub Pages
- Repository: `anica-blip/3c-card-games`
- Pages source: `main` branch, root `/`
- Admin protected by GitHub sign-in through Supabase (owner only)

**Live URLs:**
```
Admin login:    https://anica-blip.github.io/3c-card-games/admin/login.html
Admin panel:    https://anica-blip.github.io/3c-card-games/admin/index.html
Landing upload: https://anica-blip.github.io/3c-card-games/admin/landing-upload.html
Public game:    https://anica-blip.github.io/3c-card-games/public/index.html?deck={slug}
Shared URL:     https://anica-blip.github.io/3c-card-games/landing.html?deck={slug}
```

---

## Admin Workflow

```
1. Open admin/index.html → sign in with GitHub if asked
2. Click New Deck → auto-generates deck.01, deck.02 etc.
3. Enter Deck Title
4. Add Cards → + Add Card (repeat for each card)
   - Upload Front image from computer → sent to R2 at once + local preview
   - Upload Back image from computer  → sent to R2 at once + local preview
   - Reorder with ▲ ▼ | Remove with ✕
5. Click Save Deck
   → deck JSON pushed to R2 via the Worker (with the sign-in token)
   → Supabase index row created
   → Deck URL generated (copy + share)
6. Open admin/landing-upload.html
   → Select deck from dropdown
   → Upload landing image or video from computer
   → Sent to R2 via the Worker
7. Delete Deck removes the list entry and the deck's JSON file.
   The deck's media files stay in R2 (delete them in the R2 dashboard if wanted).
   If the JSON file could not be removed, the admin says so.
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
