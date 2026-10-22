'use strict';
// Catches, reading a drawing or a photo against the stand-in model
// (scripts/mock-openrouter.mjs, never the real OpenRouter), choosing,
// saving, the groups and the opens record, against a real server with its
// own empty records folder.
//   npm test

const test = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const zlib = require('node:zlib');
const Database = require('better-sqlite3');

const PORT = 8912;
const MOCK_PORT = 8932;
const PASS = 'open sesame';
const base = `http://127.0.0.1:${PORT}`;
const mock = `http://127.0.0.1:${MOCK_PORT}`;
const root = path.join(__dirname, '..');
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'kanji-test-'));
const procs = [];
let jar;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function up(url) {
  for (let i = 0; i < 100; i++) { try { await fetch(url); return; } catch { await wait(50); } }
  throw new Error(`${url} never answered`);
}

// A small, real PNG of the given size (grey), for a drawing or a photo.
function png(width, height) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 0;
  const rows = Buffer.alloc((width + 1) * height, 0x80);
  for (let y = 0; y < height; y++) rows[y * (width + 1)] = 0;
  const file = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
  return `data:image/png;base64,${file.toString('base64')}`;
}

const json = (method, p, body) => fetch(`${base}${p}`, {
  method, headers: { cookie: jar, 'content-type': 'application/json', accept: 'application/json' }, body: body ? JSON.stringify(body) : undefined,
});
const calls = async () => (await (await fetch(`${mock}/calls`)).json()).calls;
const setFail = (fail) => fetch(`${mock}/control`, { method: 'POST', body: JSON.stringify({ fail }) });
const records = () => new Database(path.join(DATA_DIR, 'kanji.db'), { readonly: true });

test.before(async () => {
  procs.push(spawn('node', ['scripts/mock-openrouter.mjs', String(MOCK_PORT)], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] }));
  procs.push(spawn('node', ['server.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(PORT), APP_PASSWORD: PASS, COOKIE_SECRET: 'x'.repeat(64), COOKIE_INSECURE: '1', DATA_DIR,
      OPENROUTER_API_KEY: 'test-key', OPENROUTER_URL: `${mock}/v1/chat/completions` },
    stdio: ['ignore', 'ignore', 'inherit'],
  }));
  await up(`${mock}/calls`);
  await up(`${base}/alive`);
  const r = await fetch(`${base}/login`, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ passphrase: PASS, next: '/' }).toString() });
  jar = r.headers.get('set-cookie').split(';')[0];
});
test.after(() => { for (const p of procs) p.kill(); fs.rmSync(DATA_DIR, { recursive: true, force: true }); });

test('the data routes sit behind the sign-in', async () => {
  const r = await fetch(`${base}/data/home`, { headers: { accept: 'application/json' } });
  assert.equal(r.status, 401);
});

test('GET /data/group/radical/173 holds 雨, sorted by frequency; an unknown kind is refused naming the kinds', async () => {
  const r = await json('GET', `/data/group/radical/173`);
  assert.equal(r.status, 200);
  const g = await r.json();
  assert.equal(g.label, '部首 雨 (173)');
  assert.equal(g.count, g.chars.length);
  assert.deepEqual(g.chars.slice(0, 5).map((x) => x.c), ['電', '震', '露', '需', '雨']);
  const bad = await json('GET', '/data/group/kind-that-does-not-exist/1');
  assert.equal(bad.status, 400);
  assert.deepEqual(await bad.json(), { error: 'kind must be one of list, grade, radical, strokes, on, kun, nanori, variant' });
});

test('an unknown character and an unknown catch are refused naming what is valid', async () => {
  const r = await json('GET', `/data/char/${encodeURIComponent('A')}`);
  assert.equal(r.status, 404);
  assert.match((await r.json()).error, /^character must be one of the 13108 kanji in the data \(KANJIDIC2\)/);
  const c = await json('POST', '/catch/999999/read');
  assert.equal(c.status, 404);
  assert.match((await c.json()).error, /^no catch with id "999999"; /);
  const k = await json('POST', '/catch', { kind: 'sketch' });
  assert.equal(k.status, 400);
  assert.deepEqual(await k.json(), { error: 'kind must be one of typed, drawn, photo, note' });
});

test('a typed catch answers its kanji as candidates; typed text with no kanji answers none', async () => {
  const r = await json('POST', '/catch', { kind: 'typed', text: '峠を越えた雨', where: 'a novel' });
  assert.equal(r.status, 200);
  const got = await r.json();
  assert.deepEqual(got.candidates, ['峠', '越', '雨']);
  assert.equal(got.catch.kind, 'typed');
  assert.equal(got.catch.char, null);
  const none = await (await json('POST', '/catch', { kind: 'typed', text: 'hello ありがとう' })).json();
  assert.deepEqual(none.candidates, []);
  assert.equal(none.catch, null);
});

test('"Read it" on a drawing and on a photo keeps only the two answered kanji that are in the data', async () => {
  const before = await calls();
  const drawn = await (await json('POST', '/catch', { kind: 'drawn', image: png(300, 300) })).json();
  assert.equal(drawn.catch.char, null);
  assert.equal(await calls(), before, 'making the catch calls no model');
  const r = await json('POST', `/catch/${drawn.catch.id}/read`);
  assert.equal(r.status, 200);
  const read = await r.json();
  assert.deepEqual(read.candidates, ['雨', '峠']);
  assert.deepEqual(read.dropped, ['龘']);
  assert.equal(await calls(), before + 1);
  const last = (await (await fetch(`${mock}/calls`)).json()).last;
  assert.equal(last.model, 'anthropic/claude-sonnet-4.6');
  assert.equal(last.image_type, 'image/png');
  const photo = await (await json('POST', '/catch', { kind: 'photo', image: png(800, 600), where: 'temple gate' })).json();
  const p = await (await json('POST', `/catch/${photo.catch.id}/read`)).json();
  assert.deepEqual(p.candidates, ['峠', '雨']);
});

test('an image over 1600 px on its long side is refused naming the limit', async () => {
  const r = await json('POST', '/catch', { kind: 'photo', image: png(1700, 10) });
  assert.equal(r.status, 400);
  assert.equal((await r.json()).error, 'image must be at most 1600 px on its long side; this one is 1700×10');
});

test('a model failure leaves the catch a loose end and answers the line naming the cause', async () => {
  const drawn = await (await json('POST', '/catch', { kind: 'drawn', image: png(200, 200), note: 'subtitle' })).json();
  await setFail('status');
  const r = await json('POST', `/catch/${drawn.catch.id}/read`);
  await setFail('garbage');
  const r2 = await json('POST', `/catch/${drawn.catch.id}/read`);
  await setFail(null);
  assert.equal(r.status, 502);
  assert.equal((await r.json()).error, 'Could not read it: the model answered 402 (Insufficient credits).');
  assert.equal(r2.status, 502);
  assert.equal((await r2.json()).error, 'Could not read it: the model did not answer the kanji as JSON.');
  const home = await (await json('GET', '/data/home')).json();
  assert.ok(home.loose.some((c) => c.id === drawn.catch.id), 'still a loose end');
  const status = await (await fetch(`${base}/status`, { headers: { cookie: jar } })).text();
  assert.match(status, /OpenRouter answered 402/);
});

test('choose resolves a loose end and writes one saved row', async () => {
  const note = await (await json('POST', '/catch', { kind: 'note', note: 'plaque at the temple gate, something with 雨 on top' })).json();
  let home = await (await json('GET', '/data/home')).json();
  assert.ok(home.loose.some((c) => c.id === note.catch.id));
  const r = await json('POST', `/catch/${note.catch.id}/choose`, { char: '雫' });
  assert.equal(r.status, 200);
  const got = await r.json();
  assert.equal(got.catch.char, '雫');
  assert.ok(got.catch.resolved_at);
  assert.equal(got.saved, true);
  const db = records();
  assert.deepEqual(db.prepare("SELECT char, first_catch_id FROM saved WHERE char = '雫'").all(), [{ char: '雫', first_catch_id: note.catch.id }]);
  db.close();
  home = await (await json('GET', '/data/home')).json();
  assert.ok(!home.loose.some((c) => c.id === note.catch.id), 'no longer a loose end');
  assert.equal(home.latest[0].char, '雫');
  const char = await (await json('GET', `/data/char/${encodeURIComponent('雫')}`)).json();
  assert.equal(char.saved, true);
  assert.equal(char.catches[0].id, note.catch.id);
  const bad = await json('POST', `/catch/${note.catch.id}/choose`, { char: 'A' });
  assert.equal(bad.status, 404);
});

test('save and unsave a character from its page; Yours lists saved characters newest first', async () => {
  let r = await (await json('POST', '/save', { char: '辻' })).json();
  assert.deepEqual(r, { char: '辻', saved: true });
  await json('POST', '/save', { char: '峠' });
  const yours = await (await json('GET', '/data/yours')).json();
  assert.deepEqual(yours.saved.slice(0, 2).map((s) => s.char), ['峠', '辻']);
  r = await (await json('POST', '/unsave', { char: '辻' })).json();
  assert.deepEqual(r, { char: '辻', saved: false });
  const g = await (await json('GET', '/data/group/strokes/9')).json();
  assert.equal(g.chars.find((x) => x.c === '峠').saved, true);
});

test('a character page opened from a group writes one opens row with the group\'s kind and value', async () => {
  const count = () => { const db = records(); const n = db.prepare('SELECT COUNT(*) AS n FROM opens').get().n; db.close(); return n; };
  const before = count();
  const r = await fetch(`${base}/k/${encodeURIComponent('雨')}?kind=radical&value=173`, { headers: { cookie: jar } });
  assert.equal(r.status, 200);
  assert.match(await r.text(), /<h1 class="big-char" lang="ja">雨<\/h1>/);
  assert.equal(count(), before + 1);
  const db = records();
  const row = db.prepare('SELECT char, from_kind, from_value FROM opens ORDER BY rowid DESC LIMIT 1').get();
  db.close();
  assert.deepEqual({ ...row }, { char: '雨', from_kind: 'radical', from_value: '173' });
  // opened from elsewhere: a row with no fact
  await fetch(`${base}/k/${encodeURIComponent('峠')}`, { headers: { cookie: jar } });
  const db2 = records();
  assert.deepEqual({ ...db2.prepare('SELECT char, from_kind, from_value FROM opens ORDER BY rowid DESC LIMIT 1').get() }, { char: '峠', from_kind: null, from_value: null });
  db2.close();
  const missing = await fetch(`${base}/k/A`, { headers: { cookie: jar } });
  assert.equal(missing.status, 404);
  assert.match(await missing.text(), /A is not one of the 13,108 kanji in the data \(KANJIDIC2\)\./);
  assert.equal(count(), before + 2, 'an unknown character writes no row');
});

test('a note loose end is resolved by typing (no catch made) or by a drawing read for it', async () => {
  const note = await (await json('POST', '/catch', { kind: 'note', note: 'something with 雨 on top' })).json();
  const typed = await (await json('GET', `/data/candidates?text=${encodeURIComponent('雪かな')}`)).json();
  assert.deepEqual(typed.candidates, ['雪']);
  const plain = await json('POST', `/catch/${note.catch.id}/read`);
  assert.equal(plain.status, 400);
  assert.match((await plain.json()).error, /has no image to read; send a drawing as image/);
  const read = await (await json('POST', `/catch/${note.catch.id}/read`, { image: png(200, 200) })).json();
  assert.deepEqual(read.candidates, ['雨', '峠']);
  assert.match(read.catch.image, /^\/img\/\d+-[0-9a-f]{8}\.png$/);
  const img = await fetch(`${base}${read.catch.image}`, { headers: { cookie: jar } });
  assert.equal(img.status, 200);
  assert.equal(img.headers.get('content-type'), 'image/png');
});

test('reopening the home page makes no model request', async () => {
  const before = await calls();
  for (let i = 0; i < 3; i++) {
    assert.equal((await fetch(`${base}/`, { headers: { cookie: jar } })).status, 200);
    assert.equal((await json('GET', '/data/home')).status, 200);
  }
  assert.equal(await calls(), before);
});
