// The Explore page: Themes, each one line opening a group or a theme page;
// Ask, a question read into places to start by the model, only when Dan
// presses "Explore"; Earlier, his explorations newest first.
'use strict';

const $ = (id) => document.getElementById(id);
const MAX = 500;
const COUNT_FROM = 400;

function showEarlier(earlier) {
  $('earlier-part').hidden = !earlier.length;
  $('earlier').replaceChildren(...earlier.map((x) => el('li', {}, el('a', { href: `/explore/${x.id}`, 'data-exploration': x.id },
    el('span', {}, x.question), el('span', { class: 'meta' }, day(x.created_at))))));
}

async function load() {
  const d = await api('GET', '/data/explore');
  $('themes').replaceChildren(...d.themes.map((t) => el('li', {}, el('a', { href: t.href, 'data-theme': t.id }, t.title))));
  showEarlier(d.earlier);
}

// The counter shows from 400 characters on.
$('question').addEventListener('input', () => {
  const n = [...$('question').value].length;
  $('counter').hidden = n < COUNT_FROM;
  $('counter').textContent = `${n} of ${MAX}`;
  askAgain();
});

// "Explore" is replaced in place by "Thinking…", then by the result's link
// or the failure line (rule 3). Changing the question once the answer is
// in brings it back (the answer stays under Earlier); while "Thinking…"
// shows, typing changes nothing on the page.
const askBtn = $('ask');
let asking = false;
function askAgain() {
  if (asking || askBtn.isConnected) return;
  askBtn.style.marginTop = '';
  askBtn.style.marginBottom = '';
  $('ask-out').replaceChildren(askBtn);
}

askBtn.addEventListener('click', () => {
  const question = $('question').value.trim();
  if (!question) { $('ask-out').querySelector('.say')?.remove(); askBtn.after(el('p', { class: 'say bad' }, 'Write a question first.')); return; }
  asking = true;
  explore(question, askBtn).then(() => load()).catch(() => {}).finally(() => { asking = false; });
});

load().catch((e) => document.querySelector('main').append(el('p', { class: 'say bad' }, e.message)));
