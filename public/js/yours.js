// Yours: his saved characters, newest first, each opening its page.
'use strict';

(async () => {
  const { saved } = await api('GET', '/data/yours');
  document.getElementById('yours').replaceChildren(...saved.map((s) => el('li', {}, el('a', { href: charLink(s.char), lang: 'ja', title: `saved ${day(s.saved_at)}` }, s.char))));
  document.getElementById('yours-none').hidden = saved.length > 0;
})().catch((e) => { document.getElementById('yours-none').textContent = e.message; document.getElementById('yours-none').hidden = false; });
