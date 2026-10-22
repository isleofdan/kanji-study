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
// The result keeps at least the replaced control's height, so the page does
// not get shorter under him (a shorter page near its foot makes the browser
// pull the scroll back, moving everything down).
function replaceInPlace(node, next) {
  const box = node.getBoundingClientRect();
  const before = box.top;
  next.style.minHeight = `${box.height}px`;
  next.style.boxSizing = 'border-box';
  node.replaceWith(next);
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

// A row of candidates as large characters to tap.
function candidateList(chars, onPick) {
  return el('ul', { class: 'chars big candidates' }, chars.map((c) => el('li', {}, el('button', { type: 'button', lang: 'ja', 'data-char': c, onclick: () => onPick(c) }, c))));
}
