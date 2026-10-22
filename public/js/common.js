// Shared by every page: the data routes, a small element builder, and the
// drawing pad and photo reducer the Catch page and its loose ends use.
'use strict';

const api = async (method, path, body) => {
  const res = await fetch(path, {
    method,
    headers: { accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) throw Object.assign(new Error(data.error || `The server answered ${res.status}.`), { status: res.status, data });
  return data;
};

// el('a', { href: '/x', class: 'y' }, 'text', child, …)
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (k === 'class') node.className = v;
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) node.append(c.nodeType ? c : String(c));
  return node;
}

const day = (iso) => new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
const charLink = (c, query = '') => `/k/${encodeURIComponent(c)}${query}`;

// Replaces `node` with `next` and keeps `next` at the same height on the
// screen as `node` was (CLAUDE.md, rule 3: a control keeps Dan's place).
// `anchor` is what he pressed (by default `node` itself): `next` is placed
// where the anchor's top was, even when the anchor sat lower down inside
// `node` (a candidate on a second row). The region keeps at least the
// replaced node's height and margins, so the page does not get shorter
// under him (a shorter page near its foot makes the browser pull the scroll
// back, moving everything down).
function replaceInPlace(node, next, anchor = node) {
  const box = node.getBoundingClientRect();
  const before = anchor.getBoundingClientRect().top;
  const style = getComputedStyle(node);
  const region = document.createElement('div');
  region.style.display = 'flow-root';
  region.style.minHeight = `${box.height}px`;
  region.style.margin = `${style.marginTop} 0 ${style.marginBottom}`;
  next.style.marginTop = `${before - box.top}px`;
  next.style.marginBottom = '0';
  region.append(next);
  node.replaceWith(region);
  const after = next.getBoundingClientRect().top;
  if (after !== before) window.scrollBy(0, after - before);
  return next;
}

// A square drawing pad for a finger or a stylus. Answers { clear, empty, png }.
function drawingPad(canvas) {
  const ctx = canvas.getContext('2d');
  let drawn = false;
  let last = null;
  const reset = () => {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#111';
    ctx.lineWidth = canvas.width / 30;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    drawn = false;
  };
  const at = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
  };
  canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); last = at(e); ctx.beginPath(); ctx.arc(last.x, last.y, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fillStyle = '#111'; ctx.fill(); drawn = true; });
  canvas.addEventListener('pointermove', (e) => {
    if (!last) return;
    const p = at(e);
    ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    last = p;
  });
  const end = () => { last = null; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  reset();
  return { clear: reset, empty: () => !drawn, png: () => canvas.toDataURL('image/png') };
}

// A picked or photographed picture, reduced to at most 1600 px on its long
// side, as a JPEG data URL (the server refuses anything larger).
function reducePhoto(file, maxSide = 1600) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * scale);
      c.height = Math.round(img.naturalHeight * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => reject(new Error('That picture could not be opened.'));
    img.src = URL.createObjectURL(file);
  });
}

// Asks the server to explore `question` (the model is called only now).
// `button` is replaced in place by "Thinking…", then by the result: a link
// to the saved exploration, or the failure line with the button again
// under it (rule 3). Answers the exploration.
async function explore(question, button) {
  const thinking = replaceInPlace(button, el('div', { class: 'thinking', role: 'status' }, 'Thinking…'));
  let x;
  try {
    x = (await api('POST', '/explore', { question })).exploration;
  } catch (e) {
    replaceInPlace(thinking, el('div', {}, el('p', { class: 'say bad' }, e.message), button));
    throw e;
  }
  const shown = x.error
    ? el('div', { 'data-result': x.id }, el('p', { class: 'say bad' }, x.error), button)
    : el('div', { class: 'result', 'data-result': x.id }, el('a', { href: `/explore/${x.id}` }, 'Open the result'));
  button.style.marginTop = '';
  replaceInPlace(thinking, shown);
  return x;
}

// A group as one tappable line: its heading's words from the data and how
// many characters it holds (Explore's themes and explorations).
const groupLine = (g, query = '') => el('li', {}, el('a', { href: `/g/${encodeURIComponent(g.kind)}/${encodeURIComponent(g.value)}${query}` },
  el('span', { lang: 'ja' }, g.label), ' ', el('span', { class: 'count' }, `${g.count.toLocaleString('en')} ${g.count === 1 ? 'character' : 'characters'}`)));

// A candidate's first meanings from the data, in small text under it, so
// Dan can tell which one he saw; nothing when the data has none.
const gloss = (meaning, c) => (meaning && meaning[c] ? el('span', { class: 'gloss' }, meaning[c].join(', ')) : null);

// A row of candidates as large characters to tap, each with its first
// meanings (`meaning`, by character, as the server answers it);
// onPick(char, list, button) gets the list, whose place the result takes,
// and the button he pressed, where the result is put.
function candidateList(chars, onPick, meaning = {}) {
  const list = el('ul', { class: 'chars big candidates' });
  list.append(...chars.map((c) => el('li', {},
    el('button', { type: 'button', lang: 'ja', 'data-char': c, onclick: (e) => onPick(c, list, e.currentTarget) }, c),
    gloss(meaning, c))));
  return list;
}
