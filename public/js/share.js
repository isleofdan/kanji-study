// The share page: what another app shared to Kanji, held by the service
// worker (sw.js) until this page reads it. It is saved at once, with no
// tap: text holding kanji as a typed catch with its candidates to choose
// from, other text or a bare link as a note, a picture as a photo catch
// with "Read it" and Keep, as the Photo button does. The model is called
// only when "Read it" is pressed.
'use strict';

const SHARE_CACHE = 'kanji-share';
const HELD = '/share/held';
const TYPED_MAX = 200; // the server keeps this much of a typed catch
const PICTURE_MAX_MB = 20;
const PICTURE_TYPES = ['image/png', 'image/jpeg'];
const out = document.getElementById('share-out');

// The held share, or null. It is removed (`drop`) once it is saved or
// refused; a failure on the way to the server leaves it held for a reload.
async function held() {
  if (!('caches' in window)) return null;
  const cache = await caches.open(SHARE_CACHE);
  const res = await cache.match(HELD);
  if (!res) return null;
  return { form: await res.formData(), drop: () => cache.delete(HELD) };
}

const nothing = () => out.replaceChildren(
  el('p', { id: 'nothing' }, 'Nothing was shared. Share text or a picture to Kanji from another app.'),
  el('p', {}, el('a', { href: '/' }, 'Go to Catch')));

// The sentence about the saved record, spelled from the server's answer.
function savedLine(c) {
  if (!c || !c.id || c.resolved_at) throw new Error('The server did not save it as a loose end.');
  return el('p', { class: 'say', id: 'saved' }, 'Saved as a loose end.');
}

function refusal(file) {
  const type = file.type ? file.type.replace(/^image\//, '').toUpperCase() : 'of a type the phone did not name';
  const what = PICTURE_TYPES.includes(file.type) ? `${(file.size / 1048576).toFixed(1)} MB` : type;
  return say(`Kanji takes PNG or JPEG pictures of at most ${PICTURE_MAX_MB} MB; this one is ${what}. Nothing was saved.`, true);
}

async function sharePicture(file, note, where) {
  if (!PICTURE_TYPES.includes(file.type) || file.size > PICTURE_MAX_MB * 1048576) { out.replaceChildren(refusal(file)); return; }
  let image;
  try { image = await reducePhoto(file); } catch {
    out.replaceChildren(say(`That picture could not be opened. Kanji takes PNG or JPEG pictures of at most ${PICTURE_MAX_MB} MB. Nothing was saved.`, true));
    return;
  }
  const got = await api('POST', '/catch', { kind: 'photo', image, note, where });
  const id = got.catch.id;
  const keep = el('button', { class: 'btn secondary', type: 'button', id: 'share-keep' }, 'Keep as a loose end');
  const photoOut = el('div', { id: 'share-photo-out' }, keep);
  const read = el('button', { class: 'btn', type: 'button', id: 'share-read' }, 'Read it');
  read.addEventListener('click', () => readInto(photoOut, id));
  // The catch is already saved; Keep confirms from the records that it
  // waits under Loose ends, and says so in its place.
  keep.addEventListener('click', async () => {
    try {
      const home = await api('GET', '/data/home');
      if (!home.loose.some((c) => c.id === id)) throw new Error('It is not under Loose ends.');
      replaceInPlace(keep, say('Kept as a loose end.'));
    } catch (e) { keep.after(say(e.message, true)); }
  });
  out.replaceChildren(el('img', { class: 'preview', id: 'share-preview', src: got.catch.image, alt: '' }), savedLine(got.catch), read, photoOut);
}

async function shareText(text, where) {
  const got = await api('POST', '/catch', { kind: 'typed', text: text.slice(0, TYPED_MAX), where });
  if (!got.candidates.length) return false;
  out.replaceChildren(
    el('p', { class: 'shared', lang: 'ja' }, text),
    savedLine(got.catch),
    el('p', { class: 'say' }, 'Tap the one you saw:'),
    el('ul', { class: 'chars big candidates' }, got.candidates.map((c) =>
      el('li', {}, el('a', { href: charLink(c, `?catch=${got.catch.id}`), lang: 'ja' }, c), gloss(got.meaning, c)))));
  return true;
}

async function shareNote(note, where) {
  const got = await api('POST', '/catch', { kind: 'note', note, where });
  out.replaceChildren(el('p', { class: 'shared', lang: 'ja' }, note), savedLine(got.catch), el('p', {}, el('a', { href: '/' }, 'See it under Loose ends')));
}

(async () => {
  const h = await held();
  if (!h) return nothing();
  const field = (k) => { const v = h.form.get(k); return typeof v === 'string' ? v.trim() : ''; };
  const [title, text, url] = ['title', 'text', 'url'].map(field);
  const picture = h.form.get('photos');
  try {
    if (picture && typeof picture !== 'string') await sharePicture(picture, text || null, url || title || null);
    else if (text && await shareText(text, url || title || null)) { /* shown */ }
    else if (text || url) await shareNote([text, url].filter(Boolean).join('\n'), title || null);
    else if (title) await shareNote(title, null);
    else nothing();
  } catch (e) {
    // The server refused it (4xx): it will not go better on a reload, so the
    // share is let go. Otherwise it stays held for the next visit.
    if (e.status >= 400 && e.status < 500 && e.status !== 401) { await h.drop(); out.replaceChildren(say(`${e.message} Nothing was saved.`, true)); return; }
    out.replaceChildren(say(`${e.message} What was shared is kept here; open this page again to save it.`, true));
    return;
  }
  await h.drop();
})().catch((e) => out.replaceChildren(say(e.message, true)));
