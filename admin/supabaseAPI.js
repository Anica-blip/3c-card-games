/**
 * 3C Card Games — Supabase API
 * ─────────────────────────────────────────────────────
 * All Supabase interactions for the admin panel.
 * Imported by admin.app.js and landing-upload.html.
 *
 * Table: card_decks
 * Columns: id, deck_slug, title, deck_url, r2_key,
 *          card_count, created_at
 *
 * Operations:
 *   fetchAllDecks()           → SELECT all rows ordered by id desc
 *   saveDeck(row)             → UPSERT row on conflict deck_slug
 *   deleteDeck(slug)          → DELETE row by deck_slug
 *   generateNextSlug(archive) → compute next deck.NN slug
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

/* ── CONNECTION ─────────────────────────────────────── */
const SUPABASE_URL = 'https://cgxjqsbrditbteqhdyus.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneGpxc2JyZGl0YnRlcWhkeXVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTExMTY1ODEsImV4cCI6MjA2NjY5MjU4MX0.xUDy5ic-r52kmRtocdcW8Np9-lczjMZ6YKPXc03rIG4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/* ── FETCH ALL DECKS ────────────────────────────────── */
/*
  Returns all rows from card_decks ordered newest first.
  Used to populate the archive table and the
  landing-upload.html deck dropdown.
*/
export async function fetchAllDecks() {
  const { data, error } = await supabase
    .from('card_decks')
    .select('deck_slug, title, deck_url, r2_key, card_count')
    .order('id', { ascending: false });

  if (error) {
    console.error('supabaseAPI.fetchAllDecks:', error.message);
    return [];
  }
  return data || [];
}

/* ── GENERATE NEXT SLUG ─────────────────────────────── */
/*
  Reads existing slugs to find the next available number.
  e.g. deck.01, deck.02 exist → returns deck.03
  Accepts the archive array so no extra fetch is needed
  if the caller already has it.
*/
export function generateNextSlug(archive) {
  const used = archive.map(d => {
    const m = d.deck_slug.match(/^deck\.(\d+)$/);
    return m ? parseInt(m[1]) : null;
  }).filter(n => n !== null);

  let n = 1;
  while (used.includes(n)) n++;
  return `deck.${String(n).padStart(2, '0')}`;
}

/* ── SAVE DECK (upsert) ─────────────────────────────── */
/*
  Inserts a new row or updates an existing one
  if deck_slug already exists (onConflict).

  row shape:
  {
    deck_slug:  'deck.01',
    title:      'Aurion\'s Lucky Wisdom Deck',
    deck_url:   'https://.../landing.html?deck=deck.01',
    r2_key:     'CardGames/deck.01/deck.json',
    card_count: 7
  }

  Returns: { data, error }
*/
export async function saveDeck(row) {
  const { data, error } = await supabase
    .from('card_decks')
    .upsert([row], { onConflict: 'deck_slug' })
    .select();

  if (error) {
    console.error('supabaseAPI.saveDeck:', error.message);
  }
  return { data, error };
}

/* ── DELETE DECK ────────────────────────────────────── */
/*
  Deletes a row by deck_slug.
  Returns: { error }
*/
export async function deleteDeck(slug) {
  const { error } = await supabase
    .from('card_decks')
    .delete()
    .eq('deck_slug', slug);

  if (error) {
    console.error('supabaseAPI.deleteDeck:', error.message);
  }
  return { error };
}
