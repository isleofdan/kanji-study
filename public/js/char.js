// A character's page: the character, Save or Saved, the catches that led to
// it, then each fact as a link to the group of characters that share it.
'use strict';

const char = document.querySelector('.big-char').textContent;
const params = new URLSearchParams(location.search);
const fromCatch = params.get('catch');
const saveBtn = document.getElementById('save');

// The fact's group, with this character marked as where Dan came from.
const groupLink = (kind, value, text) => el('a', { href: `/g/${kind}/${encodeURIComponent(value)}?from=${encodeURIComponent(char)}`, lang: 'ja' }, text);
const stem = (r) => r.split('.')[0].replace(/-/g, '');

function fact(name, ...values) {
  const shown = values.flat().filter(Boolean);
  return el('div', {}, el('dt', { lang: 'ja' }, name), el('dd', {}, shown.length ? shown : el('span', { class: 'muted' }, '—')));
}

// Opened from a typed catch (?catch=…), the button first resolves that
// catch to this character: "Save" when it is not saved yet, "Add this
// catch" when it already is (a repeated catch keeps the first save and its
// first catch). Only after that does a saved character's button unsave.
let pendingCatch = fromCatch;

function showSaved(saved) {
  const adding = saved && pendingCatch;
  saveBtn.textContent = adding ? 'Add this catch' : saved ? 'Saved' : 'Save';
  saveBtn.classList.toggle('is-saved', saved && !adding);
  saveBtn.setAttribute('aria-pressed', String(saved && !adding));
  saveBtn.dataset.saved = saved ? '1' : '';
}

// Save keeps its place: the button itself becomes "Saved" (rule 3).
saveBtn.addEventListener('click', async () => {
  saveBtn.disabled = true;
  const say = document.getElementById('say');
  say.textContent = '';
  try {
    let got;
    if (pendingCatch) { got = await api('POST', `/catch/${pendingCatch}/choose`, { char }); pendingCatch = null; }
    else if (saveBtn.dataset.saved) got = await api('POST', '/unsave', { char });
    else got = await api('POST', '/save', { char });
    showSaved(got.saved);
  } catch (e) {
    say.textContent = e.message;
    say.className = 'say bad';
  }
  saveBtn.disabled = false;
});

(async () => {
  const d = await api('GET', `/data/char/${encodeURIComponent(char)}`);
  const k = d.kanji;
  showSaved(d.saved);
  saveBtn.disabled = false;

  if (d.catches.length) {
    document.getElementById('caught').hidden = false;
    document.getElementById('catches').replaceChildren(...d.catches.map((c) => el('li', {},
      c.image ? el('img', { src: c.image, alt: '' }) : null,
      el('span', {}, [c.where_seen, c.note, day(c.created_at)].filter(Boolean).join(' · ')))));
  }

  const listName = k.list === 'joyo' ? '常用漢字' : k.list === 'jinmeiyo' ? '人名用漢字' : null;
  document.getElementById('facts').replaceChildren(
    fact('常用・人名用', listName ? groupLink('list', k.list, listName) : el('span', {}, 'どちらでもない')),
    fact('学年', k.grade ? groupLink('grade', k.grade, String(k.grade)) : null),
    fact('部首', groupLink('radical', k.radical, `${k.radical_char} (${k.radical})`)),
    fact('画数', groupLink('strokes', k.strokes, String(k.strokes))),
    fact('音読み', k.on.map((r) => groupLink('on', r, r))),
    fact('訓読み', k.kun.map((r) => groupLink('kun', stem(r), r))),
    fact('名乗り', k.nanori.map((r) => groupLink('nanori', r, r))),
    fact('異体字', k.variants.length ? groupLink('variant', char, k.variants.join(' ')) : null),
  );
  document.getElementById('source').replaceChildren(d.source, ' ', el('a', { href: 'https://www.edrdg.org/wiki/index.php/KANJIDIC_Project' }, 'KANJIDIC project'));
})().catch((e) => { document.getElementById('say').textContent = e.message; });
