// A theme page: the theme's groups as lines with their counts, or its
// characters as a grid the way group pages show them (saved ones tinted,
// the first 300, then all on "Show all").
'use strict';

const LIMIT = 300;
const id = decodeURIComponent(location.pathname.split('/')[3]);
const grid = document.getElementById('chars');
const more = document.getElementById('show-all');
const plural = (n) => `${n.toLocaleString('en')} ${n === 1 ? 'character' : 'characters'}`;

// Opening a character from here records the theme he came from.
const cell = (x) => el('li', {}, el('a', {
  href: charLink(x.c, `?kind=theme&value=${encodeURIComponent(id)}`), lang: 'ja', class: x.saved ? 'saved' : null,
}, x.c));

(async () => {
  const t = await api('GET', `/data/theme/${encodeURIComponent(id)}`);
  if (t.groups) {
    const list = document.getElementById('groups');
    list.hidden = false;
    list.replaceChildren(...t.groups.map((g) => groupLine(g)));
    document.getElementById('count').textContent = t.groups.length ? '' : 'Nothing in your records leads here yet.';
  } else {
    grid.hidden = false;
    document.getElementById('count').textContent = plural(t.chars.length);
    grid.replaceChildren(...t.chars.slice(0, LIMIT).map(cell));
    if (t.chars.length > LIMIT) {
      more.hidden = false;
      more.addEventListener('click', () => { grid.replaceChildren(...t.chars.map(cell)); more.remove(); });
    }
  }
  document.getElementById('source').replaceChildren('From the KANJIDIC2 dictionary file. ', el('a', { href: 'https://www.edrdg.org/wiki/index.php/KANJIDIC_Project' }, 'KANJIDIC project'));
})().catch((e) => { document.getElementById('count').textContent = e.message; });
