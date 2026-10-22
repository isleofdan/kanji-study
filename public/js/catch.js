// The Catch page: Type, Draw, Photo, Note, then Loose ends and Latest.
// Nothing calls the model until Dan presses "Read it".
'use strict';

const $ = (id) => document.getElementById(id);
const where = () => $('where').value.trim();
const say = (text, bad = false) => el('p', { class: bad ? 'say bad' : 'say' }, text);

// --- the four buttons open one panel at a time -------------------------------
for (const b of document.querySelectorAll('[data-panel]')) {
  b.addEventListener('click', () => {
    const open = b.getAttribute('aria-pressed') !== 'true';
    for (const o of document.querySelectorAll('[data-panel]')) {
      o.setAttribute('aria-pressed', String(open && o === b));
      $(`panel-${o.dataset.panel}`).hidden = !(open && o === b);
    }
    if (open && b.dataset.panel === 'type') $('typed').focus();
  });
}

// The result of choosing a candidate: what took the place of the control.
const chosen = (char, saved) => el('div', { class: 'result', 'data-chosen': char },
  el('span', { class: 'ja', lang: 'ja' }, char), saved ? ' saved to Yours. ' : ' chosen. ', el('a', { href: charLink(char) }, 'Open its page'));

async function choose(catchId, char, control) {
  const got = await api('POST', `/catch/${catchId}/choose`, { char });
  replaceInPlace(control, chosen(got.char, got.saved));
  loadHome();
}

// "Read it": shows "Reading…", then the candidates, or the line saying why not.
async function readInto(out, catchId, image) {
  const reading = say('Reading…');
  out.replaceChildren(reading);
  try {
    const got = await api('POST', `/catch/${catchId}/read`, image ? { image } : undefined);
    if (!got.candidates.length) { reading.textContent = 'No kanji from the data in it. It is kept as a loose end.'; return; }
    const list = candidateList(got.candidates, (c) => choose(catchId, c, list).catch((e) => list.after(say(e.message, true))));
    out.replaceChildren(el('p', { class: 'say' }, 'Tap the one you saw:'), list);
  } catch (e) {
    out.replaceChildren(say(`${e.message} It is kept as a loose end.`, true));
  }
  loadHome();
}

// --- Type ---------------------------------------------------------------------
$('type-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const out = $('type-out');
  try {
    const got = await api('POST', '/catch', { kind: 'typed', text: $('typed').value, where: where() });
    if (!got.candidates.length) { out.replaceChildren(say(got.message || 'No kanji from the data in what you typed.')); return; }
    out.replaceChildren(el('ul', { class: 'chars big candidates' }, got.candidates.map((c) =>
      el('li', {}, el('a', { href: charLink(c, `?catch=${got.catch.id}`), lang: 'ja' }, c)))));
    loadHome();
  } catch (err) { out.replaceChildren(say(err.message, true)); }
});

// --- Draw ---------------------------------------------------------------------
const pad = drawingPad($('pad'));
$('draw-clear').addEventListener('click', () => { pad.clear(); });

async function keepImage(kind, image, control) {
  const got = await api('POST', '/catch', { kind, image, where: where() });
  replaceInPlace(control, say('Kept as a loose end.'));
  loadHome();
  return got.catch;
}

$('draw-read').addEventListener('click', async () => {
  const out = $('draw-out');
  if (pad.empty()) { out.replaceChildren(say('Draw the character first.', true)); return; }
  try {
    const got = await api('POST', '/catch', { kind: 'drawn', image: pad.png(), where: where() });
    await readInto(out, got.catch.id);
  } catch (e) { out.replaceChildren(say(e.message, true)); }
});
$('draw-keep').addEventListener('click', async (e) => {
  if (pad.empty()) { e.target.after(say('Draw the character first.', true)); return; }
  try { await keepImage('drawn', pad.png(), e.target); } catch (err) { e.target.after(say(err.message, true)); }
});

// --- Photo --------------------------------------------------------------------
let photo = null;
$('photo-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    photo = await reducePhoto(file);
    $('photo-preview').src = photo;
    $('photo-preview').hidden = false;
    $('photo-read').disabled = false;
    const keep = $('photo-keep');
    if (keep) keep.disabled = false;
  } catch (err) { $('photo-out').replaceChildren(say(err.message, true)); }
});
$('photo-read').addEventListener('click', async () => {
  const out = $('photo-out');
  try {
    const got = await api('POST', '/catch', { kind: 'photo', image: photo, where: where() });
    await readInto(out, got.catch.id);
  } catch (e) { out.replaceChildren(say(e.message, true)); }
});
$('photo-keep').addEventListener('click', async (e) => {
  try { await keepImage('photo', photo, e.target); } catch (err) { e.target.after(say(err.message, true)); }
});

// --- Note ---------------------------------------------------------------------
$('note-keep').addEventListener('click', async (e) => {
  const note = $('note-text').value.trim();
  if (!note) { e.target.after(say('Write the note first.', true)); return; }
  try {
    await api('POST', '/catch', { kind: 'note', note, where: where() });
    replaceInPlace(e.target, say('Kept as a loose end.'));
    loadHome();
  } catch (err) { e.target.after(say(err.message, true)); }
});

// --- Loose ends: open one to resolve it by Type, Draw, or Read it ----------------
function resolver(c, li) {
  const out = el('div');
  const typed = el('input', { type: 'text', class: 'typebox ja', lang: 'ja', 'aria-label': 'Type the character' });
  const pick = (char) => choose(c.id, char, li).catch((e) => out.replaceChildren(say(e.message, true)));
  const typeForm = el('form', { onsubmit: async (e) => {
    e.preventDefault();
    try {
      const got = await api('GET', `/data/candidates?text=${encodeURIComponent(typed.value)}`);
      out.replaceChildren(got.candidates.length ? candidateList(got.candidates, pick) : say('No kanji from the data in what you typed.'));
    } catch (err) { out.replaceChildren(say(err.message, true)); }
  } }, typed, el('button', { class: 'btn', type: 'submit' }, 'Look up'));

  const canvas = el('canvas', { class: 'pad', width: 600, height: 600, 'aria-label': 'Drawing area' });
  const drawBox = el('div', { hidden: true }, canvas);
  let lpad = null;
  const readImage = (image) => readIntoFor(out, c.id, image, pick);
  const buttons = el('div', { class: 'row' },
    el('button', { class: 'btn secondary', type: 'button', onclick: () => { drawBox.hidden = false; lpad = lpad || drawingPad(canvas); } }, 'Draw'),
    el('button', { class: 'btn', type: 'button', onclick: () => {
      if (lpad && !lpad.empty()) return readImage(lpad.png());
      if (c.image) return readImage(null);
      out.replaceChildren(say('Draw the character first.', true));
    } }, 'Read it'));
  return el('div', { class: 'open' }, typeForm, drawBox, buttons, out);
}

// As readInto, but a pick resolves this loose end in place.
async function readIntoFor(out, catchId, image, pick) {
  out.replaceChildren(say('Reading…'));
  try {
    const got = await api('POST', `/catch/${catchId}/read`, image ? { image } : undefined);
    out.replaceChildren(got.candidates.length ? candidateList(got.candidates, pick) : say('No kanji from the data in it.'));
  } catch (e) { out.replaceChildren(say(e.message, true)); }
}

function looseItem(c) {
  const li = el('li', { 'data-catch': c.id });
  const head = el('button', { class: 'head', type: 'button', 'aria-expanded': 'false' },
    c.image ? el('img', { class: 'thumb', src: c.image, alt: '' }) : null,
    el('span', {},
      el('span', { lang: 'ja' }, c.note || (c.kind === 'drawn' ? 'A drawing' : c.kind === 'photo' ? 'A photo' : '')),
      el('br'),
      el('span', { class: 'meta' }, [c.where_seen, day(c.created_at)].filter(Boolean).join(' · '))));
  let open = null;
  head.addEventListener('click', () => {
    if (open) { open.remove(); open = null; head.setAttribute('aria-expanded', 'false'); return; }
    open = resolver(c, li);
    li.append(open);
    head.setAttribute('aria-expanded', 'true');
  });
  li.append(head);
  return li;
}

// Loose ends and Latest. A loose end being resolved on screen keeps its
// place until the page is reloaded; new ones join at the end.
async function loadHome() {
  const home = await api('GET', '/data/home');
  const list = $('loose');
  const shown = new Set([...list.children].map((li) => Number(li.dataset.catch)));
  for (const c of home.loose) if (!shown.has(c.id)) list.append(looseItem(c));
  $('loose-none').hidden = list.children.length > 0;
  $('latest').replaceChildren(...home.latest.map((c) => el('li', {}, el('a', { href: charLink(c.char), lang: 'ja', title: [c.where_seen, day(c.created_at)].filter(Boolean).join(' · ') }, c.char))));
  $('latest-none').hidden = home.latest.length > 0;
}

loadHome().catch((e) => document.querySelector('main').append(say(e.message, true)));
