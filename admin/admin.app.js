/**
 * 3C Card Games — Admin App
 * ─────────────────────────
 * All media loaded from computer — local preview only, never uploaded here.
 * On Save Deck: ONE JSON pushed to R2 via worker with auto-constructed R2 URLs.
 * Supabase holds the deck index (slug, title, url, r2_key).
 *
 * JSON fields saved:
 *   intro   → public/index.html screen-intro  (loaded from computer in admin)
 *   finale  → public/index.html screen-finale (loaded from computer in admin)
 *   cards[] → front + back per card           (loaded from computer in admin)
 *   landing → patched separately by landing-upload.html after upload to R2
 */

import { fetchAllDecks, generateNextSlug, saveDeck, deleteDeck } from './supabaseAPI.js';

/* ── CONFIG ─────────────────────────────────────────── */
const WORKER_URL    = 'https://3c-card-games.3c-innertherapy.workers.dev';
const R2_PUBLIC     = 'https://files.3c-public-library.org/CardGames';
const PUBLIC_APP    = 'https://anica-blip.github.io/3c-card-games/landing.html';
const $  = (sel) => document.querySelector(sel);

/* ── STATE ──────────────────────────────────────────── */
let deckArchive    = [];   // all decks from Supabase
let DECK_SLUG      = null;
let DECK_TITLE     = '';
let DECK_URL       = '';
let selectedCardIdx = -1;  // which card is open in editor

// Current deck in memory
let deckData = {
  slug:   '',
  title:  '',
  intro:  { filename: 'intro.png',  localUrl: null, isVideo: false },
  finale: { filename: 'finale.png', localUrl: null, isVideo: false },
  cards:  []
  // card shape: { front: { filename, localUrl, isVideo }, back: { filename, localUrl, isVideo } }
};

/* ── HELPERS ────────────────────────────────────────── */
function pad(n) { return String(n).padStart(2, '0'); }

function r2Url(slug, filename) {
  return `${R2_PUBLIC}/${slug}/${filename}`;
}

function generateDeckUrl(slug) {
  return `${PUBLIC_APP}?deck=${slug}`;
}

function cardFilename(idx, face) {
  // face = 'front' | 'back'
  return `card-${pad(idx + 1)}-${face}.png`;
}

function isVideoFile(filename) {
  return /\.(mp4|webm|mov|ogg)$/i.test(filename);
}

/* ── DECK ARCHIVE ───────────────────────────────────── */
async function fetchDeckArchive() {
  deckArchive = await fetchAllDecks();
}

async function generateNextDeckSlug() {
  await fetchDeckArchive();
  return generateNextSlug(deckArchive);
}

/* ── NEW DECK ───────────────────────────────────────── */
async function onNewDeck() {
  DECK_SLUG  = await generateNextDeckSlug();
  DECK_TITLE = '';
  DECK_URL   = generateDeckUrl(DECK_SLUG);

  deckData = {
    slug:   DECK_SLUG,
    title:  '',
    intro:  { filename: 'intro.png',  localUrl: null, isVideo: false },
    finale: { filename: 'finale.png', localUrl: null, isVideo: false },
    cards:  []
  };

  selectedCardIdx = -1;
  await fetchDeckArchive();
  render();
}

/* ── ADD CARD ───────────────────────────────────────── */
function onAddCard() {
  const idx = deckData.cards.length;
  deckData.cards.push({
    front: { filename: cardFilename(idx, 'front'), localUrl: null, isVideo: false },
    back:  { filename: cardFilename(idx, 'back'),  localUrl: null, isVideo: false }
  });
  selectedCardIdx = deckData.cards.length - 1;
  render();
}

/* ── REMOVE CARD ────────────────────────────────────── */
function onRemoveCard(idx) {
  deckData.cards.splice(idx, 1);
  // Re-assign filenames after removal so numbering stays sequential
  deckData.cards.forEach((c, i) => {
    c.front.filename = cardFilename(i, 'front');
    c.back.filename  = cardFilename(i, 'back');
  });
  if (selectedCardIdx >= deckData.cards.length) {
    selectedCardIdx = deckData.cards.length - 1;
  }
  render();
}

/* ── MOVE CARD ──────────────────────────────────────── */
function onMoveCardUp(idx) {
  if (idx <= 0) return;
  [deckData.cards[idx - 1], deckData.cards[idx]] =
  [deckData.cards[idx], deckData.cards[idx - 1]];
  // Re-assign filenames
  deckData.cards.forEach((c, i) => {
    c.front.filename = cardFilename(i, 'front');
    c.back.filename  = cardFilename(i, 'back');
  });
  selectedCardIdx = idx - 1;
  render();
}

function onMoveCardDown(idx) {
  if (idx >= deckData.cards.length - 1) return;
  [deckData.cards[idx + 1], deckData.cards[idx]] =
  [deckData.cards[idx], deckData.cards[idx + 1]];
  deckData.cards.forEach((c, i) => {
    c.front.filename = cardFilename(i, 'front');
    c.back.filename  = cardFilename(i, 'back');
  });
  selectedCardIdx = idx + 1;
  render();
}

/* ── SELECT CARD ────────────────────────────────────── */
function onSelectCard(idx) {
  selectedCardIdx = idx;
  render();
}

/* ── FILE UPLOAD — LOCAL PREVIEW ONLY ───────────────── */
/*
  Reads the file from disk using createObjectURL.
  Nothing is sent anywhere — purely for visual preview.
  The JSON saved to R2 uses the auto-constructed R2 URL.
*/
function handleUpload(inputEl, target) {
  /*
    target is one of:
      deckData.landing
      deckData.finale
      deckData.cards[idx].front
      deckData.cards[idx].back
  */
  const file = inputEl.files[0];
  if (!file) return;

  // Revoke any previous object URL to free memory
  if (target.localUrl) URL.revokeObjectURL(target.localUrl);

  target.localUrl = URL.createObjectURL(file);
  target.isVideo  = file.type.startsWith('video/');

  // Capture real file extension — .png, .jpg, .mp4, .webm etc.
  // Updates filename so JSON stores the correct R2 URL extension
  const ext = file.name.split('.').pop().toLowerCase();
  target.filename = target.filename.replace(/\.[^.]+$/, `.${ext}`);

  render();
}

/* ── WIRE FILE INPUTS AFTER RENDER ──────────────────── */
function wireUploads() {
  // Front card upload
  const upFront = $('#uploadFront');
  if (upFront) {
    upFront.onchange = () => {
      if (selectedCardIdx < 0) return;
      handleUpload(upFront, deckData.cards[selectedCardIdx].front);
    };
  }

  // Back card upload
  const upBack = $('#uploadBack');
  if (upBack) {
    upBack.onchange = () => {
      if (selectedCardIdx < 0) return;
      handleUpload(upBack, deckData.cards[selectedCardIdx].back);
    };
  }

  // Intro upload
  const upIntro = $('#uploadIntro');
  if (upIntro) {
    upIntro.onchange = () => handleUpload(upIntro, deckData.intro);
  }

  // Finale upload
  const upFinale = $('#uploadFinale');
  if (upFinale) {
    upFinale.onchange = () => handleUpload(upFinale, deckData.finale);
  }
}

/* ── BUILD DECK JSON FOR SAVING ─────────────────────── */
/*
  Local preview URLs are never stored.
  JSON always uses auto-constructed R2 public URLs.
  All media is loaded from computer for preview only —
  filenames are captured from the file and stored as R2 URLs.
  landing field is left blank here — patched by landing-upload.html.
*/
function buildDeckJson() {
  const slug = DECK_SLUG;
  return {
    slug,
    title:   DECK_TITLE,
    landing: '',   // patched by landing-upload.html after R2 upload
    intro:   r2Url(slug, deckData.intro.filename),
    finale:  r2Url(slug, deckData.finale.filename),
    cards:   deckData.cards.map((c, i) => ({
      id:    i + 1,
      front: r2Url(slug, c.front.filename),
      back:  r2Url(slug, c.back.filename)
    }))
  };
}

/* ── SAVE DECK ──────────────────────────────────────── */
async function onSaveDeck() {
  const titleInput = $('#deckTitleInput');
  DECK_TITLE = titleInput ? titleInput.value.trim() : DECK_TITLE;

  if (!DECK_TITLE) {
    alert('Please enter a Deck Title before saving.');
    return;
  }
  if (!DECK_SLUG) {
    alert('No deck slug — click New Deck first.');
    return;
  }
  if (deckData.cards.length === 0) {
    alert('Add at least one card before saving.');
    return;
  }

  const r2Key    = `CardGames/${DECK_SLUG}/deck.json`;
  const deckJson = buildDeckJson();

  // ── Step 1: Save JSON to R2 via worker ─────────────
  try {
    const r2Res = await fetch(`${WORKER_URL}/deck/${DECK_SLUG}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(deckJson, null, 2)
    });
    if (!r2Res.ok) {
      const errText = await r2Res.text();
      throw new Error(`R2 worker error ${r2Res.status}: ${errText}`);
    }
  } catch (err) {
    alert('R2 save failed: ' + err.message);
    return;
  }

  // ── Step 2: Upsert Supabase index row ──────────────
  const { data, error } = await saveDeck({
    deck_slug:  DECK_SLUG,
    title:      DECK_TITLE,
    deck_url:   generateDeckUrl(DECK_SLUG),
    r2_key,
    card_count: deckData.cards.length
  });

  if (error) {
    alert('Deck saved to R2 ✅\nBut Supabase index failed: ' + error.message);
  } else {
    DECK_URL = generateDeckUrl(DECK_SLUG);
    await fetchDeckArchive();
    render();

    setTimeout(() => {
      const urlField = $('#deckUrlCopyField');
      if (urlField) {
        urlField.value = DECK_URL;
        urlField.focus();
        urlField.select();
      }
    }, 200);

    alert(`Deck saved: ${DECK_SLUG} (${DECK_TITLE})\nURL: ${DECK_URL}`);
  }
}

/* ── LOAD DECK FROM ARCHIVE ─────────────────────────── */
async function onLoadDeckFromArchive(slug) {
  try {
    // Fetch deck JSON from R2
    const r2Res = await fetch(`${WORKER_URL}/deck/${slug}`);
    if (!r2Res.ok) throw new Error(`R2 fetch failed (${r2Res.status})`);
    const json = await r2Res.json();

    DECK_SLUG  = slug;
    DECK_TITLE = json.title || '';
    DECK_URL   = generateDeckUrl(slug);

    // Reconstruct deckData from saved JSON
    // localUrl is null — no local file loaded yet
    // Extract real extensions from saved R2 URLs
    const extFrom = url => url ? url.split('.').pop().toLowerCase() : 'png';

    deckData = {
      slug,
      title:  json.title || '',
      intro:  { filename: `intro.${extFrom(json.intro)}`,   localUrl: null, isVideo: /mp4|webm|mov|ogg/i.test(extFrom(json.intro)) },
      finale: { filename: `finale.${extFrom(json.finale)}`, localUrl: null, isVideo: /mp4|webm|mov|ogg/i.test(extFrom(json.finale)) },
      cards:  (json.cards || []).map((c, i) => ({
        front: { filename: `card-${pad(i+1)}-front.${extFrom(c.front)}`, localUrl: null, isVideo: /mp4|webm|mov|ogg/i.test(extFrom(c.front)) },
        back:  { filename: `card-${pad(i+1)}-back.${extFrom(c.back)}`,   localUrl: null, isVideo: /mp4|webm|mov|ogg/i.test(extFrom(c.back)) }
      }))
    };

    selectedCardIdx = deckData.cards.length > 0 ? 0 : -1;
    await fetchDeckArchive();
    render();
  } catch (err) {
    alert('Failed to load deck: ' + err.message);
  }
}

/* ── DELETE DECK ────────────────────────────────────── */
async function onDeleteDeck(slug) {
  if (!confirm(`Delete deck "${slug}" permanently? This cannot be undone.`)) return;

  // Delete from R2
  try {
    await fetch(`${WORKER_URL}/deck/${slug}`, { method: 'DELETE' });
  } catch (err) {
    console.warn('R2 delete failed:', err.message);
  }

  // Delete from Supabase
  const { error } = await deleteDeck(slug);

  if (error) {
    alert('Supabase delete failed: ' + error.message);
  } else {
    // If we just deleted the active deck, reset
    if (slug === DECK_SLUG) {
      DECK_SLUG  = null;
      DECK_TITLE = '';
      DECK_URL   = '';
      deckData   = { slug: '', title: '', intro: { filename: 'intro.png', localUrl: null, isVideo: false }, finale: { filename: 'finale.png', localUrl: null, isVideo: false }, cards: [] };
      selectedCardIdx = -1;
    }
    await fetchDeckArchive();
    render();
  }
}

/* ── RENDER SIDEBAR ─────────────────────────────────── */
function renderSidebar() {
  const list = $('#cardThumbList');
  if (!list) return;

  if (!deckData.cards.length) {
    list.innerHTML = `<li style="color:#aaa; font-size:0.85em; padding:8px 4px;">No cards yet.</li>`;
    return;
  }

  list.innerHTML = deckData.cards.map((card, i) => {
    const isActive = i === selectedCardIdx;
    const thumbSrc = card.front.localUrl || '';

    return `
      <li>
        <button
          class="page-button${isActive ? ' active' : ''}"
          onclick="window._cardAdmin.selectCard(${i})"
        >
          ${thumbSrc
            ? `<img class="page-img-thumb" src="${thumbSrc}" alt="Card ${i + 1}" />`
            : `<span style="font-size:0.75em; color:${isActive ? '#fff' : '#aaa'}">No img</span>`
          }
          <span class="img-filename">Card ${pad(i + 1)}</span>
        </button>
        <button
          title="Move up"
          ${i === 0 ? 'disabled' : ''}
          onclick="window._cardAdmin.moveUp(${i})"
        >▲</button>
        <button
          title="Move down"
          ${i === deckData.cards.length - 1 ? 'disabled' : ''}
          onclick="window._cardAdmin.moveDown(${i})"
        >▼</button>
        <button
          title="Remove card"
          class="danger"
          onclick="window._cardAdmin.removeCard(${i})"
        >✕</button>
      </li>
    `;
  }).join('');
}

/* ── RENDER CARD EDITOR ─────────────────────────────── */
function renderCardEditor() {
  const panelEmpty  = $('#panelEmpty');
  const panelEditor = $('#panelEditor');

  if (selectedCardIdx < 0 || !deckData.cards[selectedCardIdx]) {
    if (panelEmpty)  panelEmpty.style.display  = 'block';
    if (panelEditor) panelEditor.style.display = 'none';
    return;
  }

  if (panelEmpty)  panelEmpty.style.display  = 'none';
  if (panelEditor) panelEditor.style.display = 'block';

  const card = deckData.cards[selectedCardIdx];

  // Update title
  const title = $('#cardEditorTitle');
  if (title) title.textContent = `Card #${pad(selectedCardIdx + 1)}`;

  // Update filename labels
  const frontName = $('#uploadFrontName');
  const backName  = $('#uploadBackName');
  if (frontName) frontName.textContent = card.front.filename;
  if (backName)  backName.textContent  = card.back.filename;

  // ── Front preview ──
  updatePreview(
    card.front,
    '#frontPreviewImg',
    '#frontPreviewVideo',
    '#frontPreviewEmpty'
  );

  // ── Back preview ──
  updatePreview(
    card.back,
    '#backPreviewImg',
    '#backPreviewVideo',
    '#backPreviewEmpty'
  );

  // ── Intro preview (filename label) ──
  const introName = $('#uploadIntroName');
  if (introName) introName.textContent = deckData.intro.filename;

  // ── Finale preview (filename label) ──
  const finaleName = $('#uploadFinaleName');
  if (finaleName) finaleName.textContent = deckData.finale.filename;
}

/* ── UPDATE A SINGLE PREVIEW CANVAS ────────────────── */
function updatePreview(target, imgSel, videoSel, emptySel) {
  const imgEl   = $(imgSel);
  const videoEl = $(videoSel);
  const emptyEl = $(emptySel);

  if (!target.localUrl) {
    if (imgEl)   { imgEl.style.display   = 'none'; imgEl.src = ''; }
    if (videoEl) { videoEl.style.display = 'none'; videoEl.src = ''; }
    if (emptyEl)   emptyEl.style.display = 'flex';
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';

  if (target.isVideo) {
    if (imgEl)   imgEl.style.display   = 'none';
    if (videoEl) {
      videoEl.src          = target.localUrl;
      videoEl.style.display = 'block';
    }
  } else {
    if (videoEl) videoEl.style.display = 'none';
    if (imgEl) {
      imgEl.src          = target.localUrl;
      imgEl.style.display = 'block';
    }
  }
}

/* ── RENDER DECK ARCHIVE TABLE ──────────────────────── */
async function renderDeckArchive() {
  const container = $('#deckArchive');
  if (!container) return;

  if (!deckArchive.length) {
    container.innerHTML = `<div style="margin-top:30px; color:#aaa;">No decks saved yet.</div>`;
    return;
  }

  const sorted = [...deckArchive].sort((a, b) => {
    const n = d => parseInt((d.deck_slug.match(/\.(\d+)$/) || [])[1] || 0);
    return n(a) - n(b);
  });

  container.innerHTML = `
    <div style="margin-top:40px;">
      <h2 style="margin-bottom:8px; color:#4682b4;">Deck Archive</h2>
      <table style="width:100%; border-collapse:collapse;">
        <thead>
          <tr style="background:#eaf4fc;">
            <th style="text-align:left; padding:8px;">Edit</th>
            <th style="text-align:left; padding:8px;">Deck #</th>
            <th style="text-align:left; padding:8px;">Title</th>
            <th style="text-align:left; padding:8px;">Cards</th>
            <th style="text-align:left; padding:8px;">URL</th>
            <th style="text-align:left; padding:8px;">Delete</th>
          </tr>
        </thead>
        <tbody>
          ${sorted.map(d => {
            const url = d.deck_url || generateDeckUrl(d.deck_slug);
            return `
              <tr style="border-bottom:1px solid #e3e7f2;">
                <td style="padding:8px;">
                  <button onclick="window._cardAdmin.loadDeck('${d.deck_slug}')">Edit</button>
                </td>
                <td style="padding:8px;">${d.deck_slug}</td>
                <td style="padding:8px;">${d.title || ''}</td>
                <td style="padding:8px;">${d.card_count || 0}</td>
                <td style="padding:8px;">
                  <input type="text" value="${url}" readonly style="width:60%;">
                  <button onclick="navigator.clipboard.writeText('${url}')">Copy</button>
                  <a href="${url}" target="_blank" style="margin-left:8px;">Open</a>
                </td>
                <td style="padding:8px;">
                  <button class="danger" onclick="window._cardAdmin.deleteDeck('${d.deck_slug}')">Delete</button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/* ── MAIN RENDER ────────────────────────────────────── */
function render() {
  // Top controls
  const titleInput = $('#deckTitleInput');
  if (titleInput && document.activeElement !== titleInput) {
    titleInput.value = DECK_TITLE;
  }

  const slugLabel = $('#deckSlugLabel');
  const slugSub   = $('#deckSlugSub');
  if (slugLabel) slugLabel.textContent = DECK_SLUG || '[new deck]';
  if (slugSub)   slugSub.textContent   = DECK_SLUG ? `(slug: ${DECK_SLUG})` : '';

  const urlField = $('#deckUrlCopyField');
  if (urlField) urlField.value = DECK_URL;

  // Sidebar
  renderSidebar();

  // Card editor
  renderCardEditor();

  // Archive
  renderDeckArchive();

  // Re-wire all upload inputs after each render
  wireUploads();

  // Wire buttons
  const newBtn = $('#newDeckBtn');
  if (newBtn) newBtn.onclick = onNewDeck;

  const saveBtn = $('#saveDeckBtn');
  if (saveBtn) saveBtn.onclick = onSaveDeck;

  const addCardBtn = $('#addCardBtn');
  if (addCardBtn) addCardBtn.onclick = onAddCard;

  const copyBtn = $('#copyDeckUrlBtn');
  if (copyBtn) {
    copyBtn.onclick = () => {
      const f = $('#deckUrlCopyField');
      if (f) {
        f.select();
        document.execCommand('copy');
        const msg = $('#deckUrlCopiedMsg');
        if (msg) {
          msg.style.display = 'inline';
          setTimeout(() => { msg.style.display = 'none'; }, 1100);
        }
      }
    };
  }

  const titleEl = $('#deckTitleInput');
  if (titleEl) {
    titleEl.oninput = () => { DECK_TITLE = titleEl.value; };
  }
}

/* ── EXPOSE TO HTML onclick HANDLERS ───────────────── */
window._cardAdmin = {
  selectCard:  onSelectCard,
  moveUp:      onMoveCardUp,
  moveDown:    onMoveCardDown,
  removeCard:  onRemoveCard,
  loadDeck:    onLoadDeckFromArchive,
  deleteDeck:  onDeleteDeck
};

/* ── INIT ───────────────────────────────────────────── */
(async () => {
  await fetchDeckArchive();
  DECK_SLUG = await generateNextDeckSlug();
  DECK_URL  = generateDeckUrl(DECK_SLUG);
  deckData.slug = DECK_SLUG;
  render();
})();
