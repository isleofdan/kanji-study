// An exploration: the question, the model's own sentences in italics under
// "In the model's words", and the places to start as a numbered list, each
// labelled from the data and opening its group or character page. A failure
// shows its line, with "Explore" to ask the same question again.
'use strict';

const id = location.pathname.split('/')[2];
const answer = document.getElementById('answer');

function stop(s) {
  const link = s.char
    ? el('a', { href: charLink(s.char, `?kind=exploration&value=${id}`) },
      el('span', { class: 'stop-char', lang: 'ja' }, s.char), s.meaning.length ? el('span', { class: 'gloss' }, s.meaning.join(', ')) : null)
    : el('a', { href: `/g/${encodeURIComponent(s.kind)}/${encodeURIComponent(s.value)}?exploration=${id}` },
      el('span', { lang: 'ja' }, s.label), el('span', { class: 'count' }, `${s.count.toLocaleString('en')} ${s.count === 1 ? 'character' : 'characters'}`));
  return el('li', {}, link, s.why ? el('p', { class: 'why' }, s.why) : null);
}

const notInData = (n) => `${n} more the model named ${n === 1 ? 'is' : 'are'} not in the data and ${n === 1 ? 'was' : 'were'} left out.`;

(async () => {
  const x = (await api('GET', `/data/exploration/${id}`)).exploration;
  if (x.error) {
    const again = el('button', { class: 'btn', type: 'button', id: 'again' }, 'Explore');
    again.addEventListener('click', () => explore(x.question, again).catch(() => {}));
    answer.replaceChildren(el('p', { class: 'say bad', id: 'failure' }, x.error), again);
    return;
  }
  const parts = [];
  // The heading stands over any model-written sentence: the reading, or
  // only the reasons when the model gave no reading.
  if (x.reading || x.stops.some((s) => s.why)) {
    parts.push(el('section', { class: 'model-words' }, el('h2', {}, "In the model's words"), x.reading ? el('p', { class: 'reading' }, x.reading) : null));
  }
  if (x.stops.length) {
    parts.push(el('ol', { class: 'stops', id: 'stops' }, x.stops.map(stop)));
    if (x.dropped) parts.push(el('p', { class: 'muted' }, notInData(x.dropped)));
  } else {
    const themes = (await api('GET', '/data/explore')).themes;
    parts.push(el('p', { id: 'nothing' }, `Nothing in the data matched this question. The model named ${x.dropped} that the data does not hold.`),
      el('h2', {}, 'Themes'),
      el('ul', { class: 'lines' }, themes.map((t) => el('li', {}, el('a', { href: t.href }, t.title)))));
  }
  answer.replaceChildren(...parts);
  document.getElementById('source').replaceChildren('Every group and character above is from the KANJIDIC2 dictionary file; only the italic sentences are the model\'s. ',
    el('a', { href: 'https://www.edrdg.org/wiki/index.php/KANJIDIC_Project' }, 'KANJIDIC project'));
})().catch((e) => answer.replaceChildren(el('p', { class: 'say bad' }, e.message)));
