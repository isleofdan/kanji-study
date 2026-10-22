// A group page: what the characters share, how many there are, and the
// characters as a grid; the one Dan came from outlined, his saved ones tinted.
'use strict';

const LIMIT = 300;
const [, , kind, value] = location.pathname.split('/').map(decodeURIComponent);
const from = new URLSearchParams(location.search).get('from');
const grid = document.getElementById('chars');
const more = document.getElementById('show-all');

// Opening a character from here records the group he came from.
const cell = (x) => el('li', {}, el('a', {
  href: charLink(x.c, `?kind=${encodeURIComponent(kind)}&value=${encodeURIComponent(value)}`),
  lang: 'ja',
  class: [x.saved ? 'saved' : '', x.c === from ? 'origin' : ''].filter(Boolean).join(' ') || null,
  'aria-current': x.c === from ? 'true' : null,
}, x.c));

(async () => {
  const g = await api('GET', `/data/group/${encodeURIComponent(kind)}/${encodeURIComponent(value)}`);
  document.getElementById('heading').textContent = g.label;
  document.getElementById('count').textContent = `${g.count.toLocaleString('en')} ${g.count === 1 ? 'character' : 'characters'}, most frequent first`;
  // The one he came from is always shown, even past the first 300.
  const first = g.chars.slice(0, LIMIT);
  const origin = g.chars.findIndex((x) => x.c === from);
  if (origin >= LIMIT) first.push(g.chars[origin]);
  grid.replaceChildren(...first.map(cell));
  if (g.count > LIMIT) {
    more.hidden = false;
    more.addEventListener('click', () => {
      grid.replaceChildren(...g.chars.map(cell));
      more.remove();
    });
  }
  document.getElementById('source').replaceChildren(g.source, ' ', el('a', { href: 'https://www.edrdg.org/wiki/index.php/KANJIDIC_Project' }, 'KANJIDIC project'));
})().catch((e) => { document.getElementById('count').textContent = e.message; });
