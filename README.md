# 🃏 3C Card Games

**Aurion's Lucky Wisdom Deck** — a modular card game platform built for
[3C Thread To Success](https://3c-public-library.org).

A clean, mobile-first experience: players pick a number, reveal their card,
and flip it to receive a wisdom message. Fully customisable via the admin
panel — no code changes needed to update decks.

---

## Stack

- **Frontend** — Vanilla HTML / CSS / JS (zero dependencies)
- **Storage** — Cloudflare R2 (card images + deck JSON)
- **Database** — Supabase (deck index + metadata)
- **Worker** — Cloudflare Worker (admin R2 write operations)
- **Hosting** — GitHub Pages (public) + GitHub Pages (admin)

---

## Repository Structure

3c-card-games/
├── index.html
├── public/
│   └── index.html
├── admin/
│   └── index.html

---

## Setup & Architecture

See [`SETUP.md`](./SETUP.md) for full deployment instructions,
environment variables, and R2 folder conventions.

---

*Designed and created by [Claude](https://claude.ai) · Built for Chef Anica · 3C Thread To Success*
