// The Explore page: Themes, each one line opening a group or a theme page.
'use strict';

(async () => {
  const d = await api('GET', '/data/explore');
  document.getElementById('themes').replaceChildren(...d.themes.map((t) => el('li', {}, el('a', { href: t.href, 'data-theme': t.id }, t.title))));
})().catch((e) => document.querySelector('main').append(el('p', { class: 'say bad' }, e.message)));
