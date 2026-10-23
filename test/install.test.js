'use strict';
// Installing and sharing (kanji-three), against a real server: the four open
// files, the manifest, the page templates, and /share at the server.
//   npm test

const test = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const PORT = 8914;
const PASS = 'open sesame';
const base = `http://127.0.0.1:${PORT}`;
const PUBLIC = path.join(__dirname, '..', 'public');
let server;
let jar;
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'kanji-test-'));

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function up() {
  for (let i = 0; i < 100; i++) { try { await fetch(`${base}/alive`); return; } catch { await wait(50); } }
  throw new Error('server never answered');
}
const form = (fields) => ({ method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields).toString() });
const home = async () => (await fetch(`${base}/data/home`, { headers: { cookie: jar, accept: 'application/json' } })).json();

test.before(async () => {
  server = spawn('node', ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(PORT), APP_PASSWORD: PASS, COOKIE_SECRET: 'x'.repeat(64), COOKIE_INSECURE: '1', DATA_DIR },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  await up();
  const r = await fetch(`${base}/login`, form({ passphrase: PASS, next: '/' }));
  jar = r.headers.get('set-cookie').split(';')[0];
});
test.after(() => { server.kill(); fs.rmSync(DATA_DIR, { recursive: true, force: true }); });

test('the four install files answer 200 signed out, with their content types', async () => {
  const want = {
    '/manifest.webmanifest': /^application\/manifest\+json$/,
    '/sw.js': /^text\/javascript/,
    '/icon-192.png': /^image\/png$/,
    '/icon-512.png': /^image\/png$/,
  };
  for (const [p, type] of Object.entries(want)) {
    const r = await fetch(`${base}${p}`, { redirect: 'manual' });
    assert.equal(r.status, 200, p);
    assert.match(r.headers.get('content-type'), type, p);
  }
});

test('a POST to an open file is not served open', async () => {
  const r = await fetch(`${base}/sw.js`, { method: 'POST', redirect: 'manual' });
  assert.equal(r.status, 303);
  assert.match(r.headers.get('location'), /^\/login\?next=/);
});

test('the manifest: standalone, start at /, two icons, a POST multipart share target with a picture field', async () => {
  const m = await (await fetch(`${base}/manifest.webmanifest`)).json();
  assert.equal(m.name, 'Kanji');
  assert.equal(m.short_name, 'Kanji');
  assert.equal(m.display, 'standalone');
  assert.equal(m.start_url, '/');
  assert.equal(m.scope, '/');
  assert.equal(m.background_color, '#fafaf8');
  assert.equal(m.theme_color, '#2f6f4f');
  assert.deepEqual(m.icons.map((i) => [i.src, i.sizes, i.purpose]), [['/icon-192.png', '192x192', 'any'], ['/icon-512.png', '512x512', 'any maskable']]);
  const t = m.share_target;
  assert.equal(t.action, '/share');
  assert.equal(t.method, 'POST');
  assert.equal(t.enctype, 'multipart/form-data');
  assert.deepEqual([t.params.title, t.params.text, t.params.url], ['title', 'text', 'url']);
  assert.equal(t.params.files.length, 1);
  assert.equal(t.params.files[0].name, 'photos');
  for (const type of ['image/png', 'image/jpeg']) assert.ok(t.params.files[0].accept.includes(type), type);
});

test('the two icons are PNGs of 192 and 512 px', () => {
  for (const size of [192, 512]) {
    const buf = fs.readFileSync(path.join(PUBLIC, `icon-${size}.png`));
    assert.equal(buf.toString('ascii', 1, 4), 'PNG');
    assert.deepEqual([buf.readUInt32BE(16), buf.readUInt32BE(20)], [size, size]);
  }
});

test('every page template carries the manifest link and the theme colour; every page behind the cookie loads install.js', () => {
  const pages = fs.readdirSync(PUBLIC).filter((f) => f.endsWith('.html'));
  assert.ok(pages.includes('share.html') && pages.includes('login.html'));
  for (const f of pages) {
    const html = fs.readFileSync(path.join(PUBLIC, f), 'utf8');
    assert.match(html, /<link rel="manifest" href="\/manifest\.webmanifest">/, f);
    assert.match(html, /<meta name="theme-color" content="#2f6f4f">/, f);
    // The sign-in page is served signed out, where /install.js is not.
    if (f !== 'login.html') assert.match(html, /<script src="\/install\.js"><\/script>/, f);
  }
});

test('install.js answers signed in', async () => {
  const r = await fetch(`${base}/install.js`, { headers: { cookie: jar } });
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /^text\/javascript/);
  assert.match(await r.text(), /serviceWorker\.register\('\/sw\.js'\)/);
});

for (const p of ['/', '/explore', '/yours', '/status', '/share', `/k/${encodeURIComponent('雨')}`, '/g/radical/173', '/explore/theme/most-strokes', '/install.js']) {
  test(`GET ${decodeURIComponent(p)} signed out redirects to sign-in`, async () => {
    const r = await fetch(`${base}${p}`, { redirect: 'manual' });
    assert.equal(r.status, 303);
    assert.equal(r.headers.get('location'), `/login?next=${encodeURIComponent(p)}`);
  });
}

test('a share signed out goes to sign-in and comes back to /share', async () => {
  const r = await fetch(`${base}/share`, { redirect: 'manual' });
  assert.equal(r.headers.get('location'), '/login?next=%2Fshare');
  const login = await (await fetch(`${base}${r.headers.get('location')}`)).text();
  assert.match(login, /<input type="hidden" name="next" value="\/share">/);
  const signed = await fetch(`${base}/login`, form({ passphrase: PASS, next: '/share' }));
  assert.equal(signed.status, 303);
  assert.equal(signed.headers.get('location'), '/share');
});

test('POST /share at the server answers 303 to /share, signed in or out, and writes no row', async () => {
  const before = await home();
  const body = new FormData();
  body.append('title', 'a page');
  body.append('text', '雨と峠');
  body.append('photos', new Blob([Buffer.from([0xff, 0xd8, 0xff])], { type: 'image/jpeg' }), 'p.jpg');
  for (const headers of [{}, { cookie: jar }]) {
    const r = await fetch(`${base}/share`, { method: 'POST', redirect: 'manual', headers, body });
    assert.equal(r.status, 303);
    assert.equal(r.headers.get('location'), '/share');
  }
  assert.deepEqual(await home(), before);
  assert.deepEqual(before, { loose: [], latest: [] });
});

// A share's save sent again with the same share_id (its answer was lost on
// the way back, then the page was reloaded) answers the catch already saved.
const post = async (body) => {
  const r = await fetch(`${base}/catch`, { method: 'POST', headers: { cookie: jar, 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json() };
};
const PNG_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

test('a share saved again under its share_id saves once, for text, a note and a picture', async () => {
  const images = () => fs.readdirSync(path.join(DATA_DIR, 'images')).length;
  const before = (await home()).loose.length;
  const typed = { kind: 'typed', text: '雨と峠', where: 'a page', share_id: 'share-typed-0001' };
  const t1 = await post(typed);
  const t2 = await post(typed);
  assert.equal(t1.status, 200);
  assert.equal(t2.body.catch.id, t1.body.catch.id);
  assert.deepEqual(t2.body.candidates, ['雨', '峠']);
  const note = { kind: 'note', note: 'no kanji here', share_id: 'share-note-00001' };
  assert.equal((await post(note)).body.catch.id, (await post(note)).body.catch.id);
  const filesBefore = images();
  const photo = { kind: 'photo', image: PNG_1PX, share_id: 'share-photo-0001' };
  const p1 = await post(photo);
  const p2 = await post(photo);
  assert.equal(p2.body.catch.id, p1.body.catch.id);
  assert.equal(images(), filesBefore + 1, 'one picture file, not two');
  assert.equal((await home()).loose.length, before + 3);
});

test('two shares of the same text with different share_ids are two catches', async () => {
  const a = await post({ kind: 'typed', text: '峠', share_id: 'share-twin-aaaa' });
  const b = await post({ kind: 'typed', text: '峠', share_id: 'share-twin-bbbb' });
  const c = await post({ kind: 'typed', text: '峠' });
  assert.notEqual(a.body.catch.id, b.body.catch.id);
  assert.notEqual(b.body.catch.id, c.body.catch.id);
});

test('a share_id that is not 8 to 64 letters, digits or dashes is refused, naming what is valid', async () => {
  const r = await post({ kind: 'note', note: 'x', share_id: 'bad id!' });
  assert.equal(r.status, 400);
  assert.equal(r.body.error, 'share_id must be 8 to 64 letters, digits or dashes');
});

test('GET /share signed in is the share page, which reads what the worker holds', async () => {
  const r = await fetch(`${base}/share`, { headers: { cookie: jar } });
  assert.equal(r.status, 200);
  const html = await r.text();
  assert.match(html, /<h1>Shared to Kanji<\/h1>/);
  assert.match(html, /<script src="\/js\/share\.js"><\/script>/);
  const js = fs.readFileSync(path.join(PUBLIC, 'js', 'share.js'), 'utf8');
  assert.ok(js.includes('Nothing was shared. Share text or a picture to Kanji from another app.'));
});
