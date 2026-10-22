'use strict';
// One plain Node server, made from isleofdan/starting-kit.
//   /login (GET, POST), /logout, /app.css, /alive  — open
//   everything else (/, /status, an app's own)     — behind the passphrase cookie
// Fail closed: with APP_PASSWORD or COOKIE_SECRET unset, only the sign-in
// page serves, and it says the server is not configured.

const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');

const app = require('./lib/app');
const auth = require('./lib/auth');
const upstream = require('./lib/upstream');
const kanji = require('./lib/kanji');
const db = require('./lib/db');
const images = require('./lib/images');
const vision = require('./lib/vision');
const ratelimit = require('./lib/ratelimit');
const { execFileSync } = require('node:child_process');
const { sendJson, sendHtml, sendText, redirect, readJson, serveStatic, escapeHtml } = require('./lib/http');

const PORT = Number(process.env.PORT) || 8080;
const PUBLIC = path.join(__dirname, 'public');
const { APP_PASSWORD, COOKIE_SECRET } = process.env;
const SECURE_COOKIE = process.env.COOKIE_INSECURE !== '1';
const CONFIGURED = Boolean(APP_PASSWORD && COOKIE_SECRET);

if (!CONFIGURED) {
  const missing = ['APP_PASSWORD', 'COOKIE_SECRET'].filter((k) => !process.env[k]);
  console.error(`not configured: ${missing.join(', ')} unset. Only the sign-in page will serve.`);
}

// When this copy started and which commit it runs. The deploy passes COMMIT;
// on a computer it is read from git, if there is one.
const STARTED = new Date();
const COMMIT = (process.env.COMMIT || (() => {
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: __dirname, stdio: ['ignore', 'pipe', 'ignore'] }).toString(); } catch { return ''; }
})()).trim().slice(0, 7) || 'unknown';
const aliveLine = () => `alive since ${STARTED.toISOString().replace(/\.\d+Z$/, 'Z')} · ${COMMIT}`;

const NOT_CONFIGURED = 'The server is not set up yet: APP_PASSWORD or COOKIE_SECRET is missing.';

// A page from public/, with {{KEY}} filled in (escaped) from `values`.
const templates = {};
function page(file, values = {}) {
  templates[file] ??= fs.readFileSync(path.join(PUBLIC, file), 'utf8');
  const all = { TITLE: app.title, ...values };
  return templates[file].replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => (k in all ? escapeHtml(all[k]) : m));
}

// Only a path on this site: never another host.
function safeNext(next) {
  return typeof next === 'string' && /^\/(?!\/)/.test(next) && !next.startsWith('/login') ? next : '/';
}

function loginPage(res, status, message = '', next = '/') {
  sendHtml(res, status, page('login.html', { MESSAGE: message, NEXT: safeNext(next) }));
}

function wantsJson(req) {
  return (req.headers.accept || '').includes('application/json')
    || (req.headers['content-type'] || '').includes('application/json');
}

async function handleLogin(req, res) {
  if (!CONFIGURED) {
    return wantsJson(req) ? sendJson(res, 503, { error: NOT_CONFIGURED }) : loginPage(res, 503, NOT_CONFIGURED);
  }
  const wait = ratelimit.lockedFor(req);
  if (wait > 0) {
    const msg = `Too many wrong passphrases. Wait about ${Math.ceil(wait / 60)} minutes, then try again.`;
    return wantsJson(req) ? sendJson(res, 429, { error: msg, retry_after_s: wait }, { 'retry-after': String(wait) })
      : loginPage(res, 429, msg);
  }
  let body;
  try { body = await readJson(req); } catch (e) { return sendJson(res, e.status || 400, { error: e.message }); }
  if (!auth.passwordOk(body.passphrase, APP_PASSWORD)) {
    ratelimit.recordFailure(req);
    const msg = 'That passphrase is not right. Try again.';
    return wantsJson(req) ? sendJson(res, 401, { error: msg }) : loginPage(res, 401, msg, body.next);
  }
  ratelimit.clear(req);
  const headers = { 'set-cookie': auth.issueCookie(COOKIE_SECRET, { secure: SECURE_COOKIE }) };
  return wantsJson(req) ? sendJson(res, 200, { ok: true }, headers) : redirect(res, safeNext(body.next), headers);
}

// --- routes behind the cookie -----------------------------------------------
// An app adds its own screens and /api/ routes here.

const routes = [];
function route(method, pattern, run) { routes.push({ method, pattern, run }); }

route('GET', /^\/$/, (req, res) => sendHtml(res, 200, page('index.html')));

// --- catches, saving, and the data the pages read ---------------------------
// Every fact comes from lib/kanji.js (KANJIDIC2); the model only reads a
// drawing or a photo when Dan presses "Read it" (lib/vision.js).

const IMAGE_BODY_MAX = 8 * 1024 * 1024;
const text = (v, max = 500) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const param = (s) => { try { return decodeURIComponent(s); } catch { return s; } };

// A catch as the pages read it: its image as an address on this site.
const shown = (c) => ({ ...c, image: c.image ? `/img/${c.image}` : null });

function mustChar(value) {
  if (typeof value !== 'string' || !value) throw Object.assign(new Error('char is required: one kanji from the data (KANJIDIC2)'), { status: 400 });
  return kanji.mustGet(value).c;
}

route('POST', /^\/catch$/, async (req, res) => {
  const body = await readJson(req, IMAGE_BODY_MAX);
  const kind = body.kind;
  if (!db.CATCH_KINDS.includes(kind)) throw Object.assign(new Error(`kind must be one of ${db.CATCH_KINDS.join(', ')}`), { status: 400 });
  const where = text(body.where);
  if (kind === 'typed') {
    const typed = text(body.text, 200);
    const candidates = kanji.inText(typed);
    if (!candidates.length) return sendJson(res, 200, { catch: null, candidates: [], message: 'No kanji from the data in what you typed.' });
    const c = db.addCatch({ kind, note: typed, where });
    return sendJson(res, 200, { catch: shown(c), candidates });
  }
  if (kind === 'note') {
    const note = text(body.note);
    if (!note) throw Object.assign(new Error('note is required for a note catch'), { status: 400 });
    return sendJson(res, 200, { catch: shown(db.addCatch({ kind, note, where })), candidates: [] });
  }
  if (!body.image) throw Object.assign(new Error(`image is required for a ${kind} catch`), { status: 400 });
  const image = images.store(body.image);
  return sendJson(res, 200, { catch: shown(db.addCatch({ kind, note: text(body.note), where, image })), candidates: [] });
});

// Sends the catch's image to the model, once per press. The catch stays a
// loose end until Dan chooses; a failure answers the line saying which.
// A loose end with no image (a note) may bring a drawing, which becomes
// its image; a newer drawing for a drawn catch is read in place of the old
// one and kept as the catch's image only if the catch had none.
route('POST', /^\/catch\/([^/]+)\/read$/, async (req, res, m) => {
  let c = db.getCatch(m[1]);
  const body = await readJson(req, IMAGE_BODY_MAX);
  let image = c.image;
  if (body.image) {
    const stored = images.store(body.image);
    c = c.image ? c : db.setImage(c.id, stored);
    image = stored;
  }
  if (!image) throw Object.assign(new Error(`catch ${c.id} has no image to read; send a drawing as image, or read a drawn or photo catch`), { status: 400 });
  try {
    const got = await vision.read(c.kind === 'photo' && image === c.image ? 'photo' : 'drawn', images.dataUrl(image));
    return sendJson(res, 200, { catch: shown(c), candidates: got.candidates, dropped: got.dropped });
  } catch (e) {
    if (!(e instanceof vision.ReadError)) throw e;
    return sendJson(res, e.status, { error: e.message, catch: shown(db.getCatch(c.id)) });
  }
});

route('POST', /^\/catch\/([^/]+)\/choose$/, async (req, res, m) => {
  const body = await readJson(req);
  db.getCatch(m[1]);
  const char = mustChar(body.char);
  const c = db.choose(m[1], char);
  return sendJson(res, 200, { catch: shown(c), char, saved: db.isSaved(char) });
});

route('POST', /^\/save$/, async (req, res) => {
  const char = mustChar((await readJson(req)).char);
  db.save(char);
  return sendJson(res, 200, { char, saved: db.isSaved(char) });
});

route('POST', /^\/unsave$/, async (req, res) => {
  const char = mustChar((await readJson(req)).char);
  db.unsave(char);
  return sendJson(res, 200, { char, saved: db.isSaved(char) });
});

route('GET', /^\/data\/char\/([^/]+)$/, (req, res, m) => {
  const k = kanji.mustGet(param(m[1]));
  return sendJson(res, 200, { kanji: k, saved: db.isSaved(k.c), catches: db.catchesFor(k.c).map(shown), source: kanji.header.licence });
});

route('GET', /^\/data\/group\/([^/]+)\/([^/]+)$/, (req, res, m) => {
  const kind = param(m[1]);
  const value = param(m[2]);
  const members = kanji.group(kind, value);
  const saved = db.savedSet();
  return sendJson(res, 200, {
    kind, value, label: kanji.label(kind, value), count: members.length,
    chars: members.map((k) => ({ c: k.c, saved: saved.has(k.c) })),
    source: kanji.header.licence,
  });
});

// The characters of typed text that are in the data, for resolving a loose
// end by typing. Makes no catch.
route('GET', /^\/data\/candidates$/, (req, res) => {
  sendJson(res, 200, { candidates: kanji.inText(new URL(req.url, 'http://x').searchParams.get('text')) });
});

// Every value of a fact kind that some character in the data has.
route('GET', /^\/data\/values\/([^/]+)$/, (req, res, m) => {
  const kind = param(m[1]);
  const all = kanji.values(kind);
  sendJson(res, 200, { kind, count: all.length, values: all });
});

route('GET', /^\/data\/home$/, (req, res) => sendJson(res, 200, { loose: db.looseEnds().map(shown), latest: db.latest(10).map(shown) }));

route('GET', /^\/data\/yours$/, (req, res) => sendJson(res, 200, { saved: db.savedList() }));

// --- the pages ----------------------------------------------------------------
// Plain HTML from public/; the page's own script (public/js/) reads the data
// routes above.

function notFoundPage(res, status, message) {
  sendHtml(res, status, page('notfound.html', { MESSAGE: message }));
}

// Opening a character page writes one opens row, with the fact Dan came
// from when he came from a group (?kind=…&value=…).
route('GET', /^\/k\/([^/]+)$/, (req, res, m) => {
  const k = kanji.get(param(m[1]));
  if (!k) return notFoundPage(res, 404, `${param(m[1])} is not one of the ${kanji.count.toLocaleString('en')} kanji in the data (KANJIDIC2).`);
  const q = new URL(req.url, 'http://x').searchParams;
  const fromKind = kanji.KINDS.includes(q.get('kind')) ? q.get('kind') : null;
  db.recordOpen(k.c, fromKind, fromKind ? text(q.get('value'), 100) : null);
  sendHtml(res, 200, page('char.html', { CHAR: k.c }));
});

route('GET', /^\/g\/([^/]+)\/([^/]+)$/, (req, res, m) => {
  const kind = param(m[1]);
  const value = param(m[2]);
  try { kanji.group(kind, value); } catch (e) { return notFoundPage(res, e.status || 400, e.message); }
  sendHtml(res, 200, page('group.html', { LABEL: kanji.label(kind, value) }));
});

route('GET', /^\/yours$/, (req, res) => sendHtml(res, 200, page('yours.html')));

route('GET', /^\/js\/([a-z]+\.js)$/, (req, res, m) => {
  if (!serveStatic(res, path.join(PUBLIC, 'js'), `/${m[1]}`)) return sendJson(res, 404, { error: 'not found' });
});

route('GET', /^\/img\/([^/]+)$/, (req, res, m) => {
  if (!images.validName(m[1]) || !serveStatic(res, db.IMAGES, `/${m[1]}`)) return sendJson(res, 404, { error: 'no such image' });
});

route('GET', /^\/status$/, (req, res) => {
  const { calls, lastError: e } = upstream.state();
  const headline = e ? `${e.service} answered ${e.status ?? 'nothing'} at ${e.at.replace('T', ' ').replace(/\.\d+Z$/, ' UTC')}`
    : calls ? `Nothing failed (${calls} calls so far).` : 'Nothing called yet.';
  sendHtml(res, 200, page('status.html', {
    ALIVE: aliveLine(), UPSTREAM_HEADLINE: headline, UPSTREAM_DETAIL: e ? e.message : '',
    DATA_LICENCE: kanji.header.licence, DATA_COUNT: kanji.count.toLocaleString('en'), DATA_VERSION: kanji.header.database_version,
  }));
});

// --- the server -------------------------------------------------------------

const OPEN_FILES = new Set(['/app.css']);

async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;

  if (p === '/alive') return sendText(res, 200, aliveLine() + '\n');
  if (p === '/login' && req.method === 'GET') return loginPage(res, CONFIGURED ? 200 : 503, CONFIGURED ? '' : NOT_CONFIGURED, url.searchParams.get('next'));
  if (p === '/login' && req.method === 'POST') return handleLogin(req, res);
  if (p === '/logout') return redirect(res, '/login', { 'set-cookie': auth.clearCookie({ secure: SECURE_COOKIE }) });
  if (req.method === 'GET' && OPEN_FILES.has(p) && serveStatic(res, PUBLIC, p)) return;

  if (!CONFIGURED || !auth.cookieOk(req, COOKIE_SECRET)) {
    if (p.startsWith('/api/') || wantsJson(req)) return sendJson(res, 401, { error: 'sign in first' });
    return redirect(res, `/login?next=${encodeURIComponent(p + url.search)}`);
  }

  for (const r of routes) {
    if (r.method !== req.method) continue;
    const m = r.pattern.exec(p);
    if (m) return r.run(req, res, m);
  }
  return sendJson(res, 404, { error: 'not found' });
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((e) => {
    const status = e.status || 500;
    if (status >= 500) console.error(e.stack || e.message);
    if (!res.headersSent) sendJson(res, status, { error: status >= 500 ? 'something went wrong on the server' : e.message });
    else res.end();
  });
});

server.listen(PORT, () => console.log(`${app.name} on ${PORT}`));

module.exports = server;
