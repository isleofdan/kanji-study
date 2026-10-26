'use strict';
// The Explore page: themes computed from the data and from Dan's records,
// and opening a character from a theme, against a real server with its own
// empty records folder.
//   npm test

const test = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const Database = require('better-sqlite3');

const PORT = 8913;
const MOCK_PORT = 8933;
const PASS = 'open sesame';
const base = `http://127.0.0.1:${PORT}`;
const mock = `http://127.0.0.1:${MOCK_PORT}`;
const root = path.join(__dirname, '..');
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'kanji-explore-'));
const procs = [];
let jar;

const DATA_IDS = ['names-only', 'joyo-unranked', 'most-variants', 'rare-radicals', 'most-strokes', 'many-readings'];
const RECORD_IDS = ['saved-radicals', 'saved-readings', 'last-catch', 'opened-unsaved'];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function up(url) {
  for (let i = 0; i < 100; i++) { try { await fetch(url); return; } catch { await wait(50); } }
  throw new Error(`${url} never answered`);
}

const json = (method, p, body) => fetch(`${base}${p}`, {
  method, headers: { cookie: jar, 'content-type': 'application/json', accept: 'application/json' }, body: body ? JSON.stringify(body) : undefined,
});
const get = async (p) => (await json('GET', p)).json();
const open = (p) => fetch(`${base}${p}`, { headers: { cookie: jar } });
const records = () => new Database(path.join(DATA_DIR, 'kanji.db'), { readonly: true });
const lastOpen = () => { const db = records(); const row = db.prepare('SELECT char, from_kind, from_value FROM opens ORDER BY rowid DESC LIMIT 1').get(); db.close(); return { ...row }; };
const listed = async () => (await get('/data/explore')).themes.map((t) => t.id);

test.before(async () => {
  procs.push(spawn('node', ['scripts/mock-openrouter.mjs', String(MOCK_PORT)], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] }));
  procs.push(spawn('node', ['server.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(PORT), APP_PASSWORD: PASS, COOKIE_SECRET: 'x'.repeat(64), COOKIE_INSECURE: '1', SENTRY_DSN: '', DATA_DIR,
      OPENROUTER_API_KEY: 'test-key', OPENROUTER_URL: `${mock}/v1/chat/completions` },
    stdio: ['ignore', 'ignore', 'inherit'],
  }));
  await up(`${mock}/calls`);
  await up(`${base}/alive`);
  const r = await fetch(`${base}/login`, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ passphrase: PASS, next: '/' }).toString() });
  jar = r.headers.get('set-cookie').split(';')[0];
});
test.after(() => { for (const p of procs) p.kill(); fs.rmSync(DATA_DIR, { recursive: true, force: true }); });

test('Explore and its data sit behind the sign-in', async () => {
  const r = await fetch(`${base}/explore`, { redirect: 'manual' });
  assert.equal(r.status, 303);
  assert.equal(r.headers.get('location'), '/login?next=%2Fexplore');
  assert.equal((await fetch(`${base}/data/explore`, { headers: { accept: 'application/json' } })).status, 401);
});

test('on empty records only the data themes are listed, and every page has Explore between Catch and Yours', async () => {
  assert.deepEqual(await listed(), DATA_IDS);
  for (const p of ['/', '/explore', '/yours', `/k/${encodeURIComponent('雨')}`, '/g/radical/173', '/explore/theme/most-strokes']) {
    assert.match(await (await open(p)).text(), /<a href="\/">Catch<\/a><a href="\/explore">Explore<\/a><a href="\/yours">Yours<\/a>/, p);
  }
});

test('every theme id answers; an unknown one is refused naming the valid ids', async () => {
  for (const id of [...RECORD_IDS, ...DATA_IDS]) {
    const r = await json('GET', `/data/theme/${id}`);
    assert.equal(r.status, 200, id);
    const t = await r.json();
    assert.equal(t.id, id);
    assert.ok(Array.isArray(t.groups || t.chars), id);
    assert.equal((await open(`/explore/theme/${id}`)).status, 200, id);
  }
  const valid = `theme must be one of ${[...RECORD_IDS, ...DATA_IDS].join(', ')}`;
  const bad = await json('GET', '/data/theme/temple-plaques');
  assert.equal(bad.status, 404);
  assert.deepEqual(await bad.json(), { error: valid });
  const page = await open('/explore/theme/temple-plaques');
  assert.equal(page.status, 404);
  assert.match(await page.text(), new RegExp(valid));
});

test('the data themes hold what their titles say', async () => {
  const themes = (await get('/data/explore')).themes;
  assert.deepEqual(themes.find((t) => t.id === 'names-only'), { id: 'names-only', title: 'Characters that appear only in names', href: '/g/list/jinmeiyo' });
  assert.equal(themes.find((t) => t.id === 'most-strokes').href, '/explore/theme/most-strokes');

  const unranked = await get('/data/theme/joyo-unranked');
  assert.equal(unranked.title, '常用 characters with no newspaper frequency rank');
  const kanji = require('../lib/kanji');
  const ks = unranked.chars.map((x) => kanji.get(x.c));
  assert.ok(ks.length > 0 && ks.every((k) => k.list === 'joyo' && k.freq === null));
  assert.equal(ks.length, kanji.group('list', 'joyo').filter((k) => k.freq === null).length);
  assert.ok(ks.every((k, i) => i === 0 || ks[i - 1].strokes <= k.strokes), 'in stroke order');

  const variants = await get('/data/theme/most-variants');
  assert.equal(variants.chars.length, 30);
  const counts = variants.chars.map((x) => kanji.get(x.c).variants.length);
  assert.ok(counts.every((n, i) => i === 0 || counts[i - 1] >= n), 'most first');

  const radicals = await get('/data/theme/rare-radicals');
  assert.equal(radicals.groups.length, 20);
  assert.ok(radicals.groups.every((g, i) => g.kind === 'radical' && (i === 0 || radicals.groups[i - 1].count <= g.count)));
  assert.match(radicals.groups[0].label, /^部首 .+ \(\d+\)$/);

  const strokes = await get('/data/theme/most-strokes');
  assert.ok(strokes.chars.length > 0 && strokes.chars.every((x) => kanji.get(x.c).strokes >= 25));

  const readings = await get('/data/theme/many-readings');
  assert.equal(readings.groups.length, 20);
  assert.ok(readings.groups.every((g, i) => g.kind === 'on' && (i === 0 || readings.groups[i - 1].count >= g.count)));
  assert.equal(readings.groups[0].label, `音読み ${readings.groups[0].value}`);
});

test('each records theme appears only once its own records exist, showing groups and no counts of what he did', async () => {
  // A group opened (radical 173, from 雨's page) with nothing saved in it.
  await open(`/k/${encodeURIComponent('雨')}?kind=radical&value=173`);
  assert.deepEqual(await listed(), ['opened-unsaved', ...DATA_IDS]);
  assert.deepEqual((await get('/data/theme/opened-unsaved')).groups.map((g) => g.label), ['部首 雨 (173)']);

  // One saved character: its radical.
  await json('POST', '/save', { char: '峠' });
  assert.deepEqual(await listed(), ['saved-radicals', 'opened-unsaved', ...DATA_IDS]);
  const radicals = await get('/data/theme/saved-radicals');
  assert.deepEqual(radicals.groups.map((g) => [g.kind, g.value]), [['radical', '46']]);
  assert.deepEqual(Object.keys(radicals.groups[0]), ['kind', 'value', 'label', 'count']);

  // Two saved characters sharing a reading (宇 and 羽, 音読み ウ).
  await json('POST', '/save', { char: '宇' });
  assert.ok(!(await listed()).includes('saved-readings'), 'one character with ウ is not a shared reading');
  await json('POST', '/save', { char: '羽' });
  assert.deepEqual(await listed(), ['saved-radicals', 'saved-readings', 'opened-unsaved', ...DATA_IDS]);
  assert.ok((await get('/data/theme/saved-readings')).groups.some((g) => g.label === '音読み ウ'));

  // A resolved catch: its 部首, 画数 and readings. Choosing 霧 also saves
  // it, which puts a saved character in radical 173.
  const c = await (await json('POST', '/catch', { kind: 'typed', text: '霧' })).json();
  await json('POST', `/catch/${c.catch.id}/choose`, { char: '霧' });
  assert.deepEqual(await listed(), ['saved-radicals', 'saved-readings', 'last-catch', ...DATA_IDS]);
  const last = await get('/data/theme/last-catch');
  assert.deepEqual(last.groups.map((g) => g.label).slice(0, 2), ['部首 雨 (173)', '画数 19']);
  assert.ok(last.groups.some((g) => g.label === '音読み ム'));
  assert.ok(last.groups.some((g) => g.label === '訓読み きり'));
});

const calls = async () => (await (await fetch(`${mock}/calls`)).json());
const setFail = (fail) => fetch(`${mock}/control`, { method: 'POST', body: JSON.stringify({ fail }) });
const QUESTION = 'characters I would meet on old weather signs';

test('nothing calls the model until "Explore" is pressed', async () => {
  const before = (await calls()).calls;
  assert.equal((await open('/explore')).status, 200);
  await get('/data/explore');
  await open('/explore/theme/rare-radicals');
  assert.equal((await calls()).calls, before);
});

test('POST /explore saves the question, keeps the three stops the data holds, drops two, and labels them from the data', async () => {
  const before = (await calls()).calls;
  const r = await json('POST', '/explore', { question: `  ${QUESTION}  ` });
  assert.equal(r.status, 200);
  const x = (await r.json()).exploration;
  assert.equal((await calls()).calls, before + 1);
  const last = (await calls()).last;
  assert.equal(last.model, 'anthropic/claude-sonnet-4.6');
  assert.equal(last.max_tokens, 1500);
  assert.match(last.ask, /characters I would meet on old weather signs/);
  assert.match(last.ask, /173 雨/, 'the radicals are listed with their numbers');
  assert.match(last.ask, /may state a dictionary fact/);

  assert.equal(x.question, QUESTION);
  assert.equal(x.model, 'anthropic/claude-sonnet-4.6');
  assert.equal(x.reading, 'You want characters you would meet on old signs about weather.');
  assert.equal(x.dropped, 2);
  assert.equal(x.error, null);
  assert.ok(Number.isInteger(x.took_ms));
  assert.deepEqual(x.stops.map((s) => s.label), ['部首 雨 (173)', '音読み ショウ', '峠']);
  assert.deepEqual(x.stops[0], { kind: 'radical', value: '173', label: '部首 雨 (173)', count: x.stops[0].count, why: 'Weather words on signs are often built on this part.' });
  assert.deepEqual(x.stops[2], { char: '峠', label: '峠', meaning: ['mountain peak', 'mountain pass', 'climax'], why: 'Old road signs in the hills often carry this one.' });

  const db = records();
  const row = db.prepare('SELECT * FROM explorations WHERE id = ?').get(x.id);
  db.close();
  assert.equal(row.question, QUESTION);
  assert.equal(row.dropped, 2);
  assert.deepEqual(JSON.parse(row.stops).map((s) => s.label), ['部首 雨 (173)', '音読み ショウ', '峠']);

  const page = await open(`/explore/${x.id}`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /<h1 id="question">characters I would meet on old weather signs<\/h1>/);
  assert.deepEqual((await get(`/data/exploration/${x.id}`)).exploration, x);
});

test('a model failure is saved on the row with its line; a garbled answer too', async () => {
  await setFail('status');
  const a = (await (await json('POST', '/explore', { question: 'temple plaques' })).json()).exploration;
  await setFail('garbage');
  const b = (await (await json('POST', '/explore', { question: 'temple plaques' })).json()).exploration;
  await setFail(null);
  assert.equal(a.error, 'Could not explore: the model answered 402 (Insufficient credits).');
  assert.equal(b.error, 'Could not explore: the model did not answer the stops as JSON.');
  const db = records();
  assert.deepEqual(db.prepare('SELECT question, error FROM explorations WHERE id IN (?, ?) ORDER BY id').all(a.id, b.id).map((r) => ({ ...r })),
    [{ question: 'temple plaques', error: a.error }, { question: 'temple plaques', error: b.error }]);
  db.close();
});

test('with no key set, the question is saved with the line naming the missing key and nothing is called', async () => {
  const before = (await calls()).calls;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kanji-nokey-'));
  const { execFileSync } = require('node:child_process');
  const env = { ...process.env, DATA_DIR: dir, OPENROUTER_URL: `${mock}/v1/chat/completions` };
  delete env.OPENROUTER_API_KEY;
  const out = execFileSync(process.execPath, ['-e', "require('./lib/explore').ask('rare names').then((x) => console.log(JSON.stringify(x)))"], { cwd: root, env }).toString();
  const x = JSON.parse(out);
  assert.equal(x.question, 'rare names');
  assert.equal(x.error, 'Could not explore: no OpenRouter key is set on the server (OPENROUTER_API_KEY).');
  assert.equal((await calls()).calls, before);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a question is refused when empty or over 500 characters; an unknown exploration id is refused naming the valid ids', async () => {
  const empty = await json('POST', '/explore', { question: '   ' });
  assert.equal(empty.status, 400);
  assert.deepEqual(await empty.json(), { error: 'question is required: up to 500 characters' });
  const long = await json('POST', '/explore', { question: '雨'.repeat(501) });
  assert.equal(long.status, 400);
  assert.deepEqual(await long.json(), { error: 'question must be at most 500 characters; this one is 501' });
  const bad = await json('GET', '/data/exploration/999');
  assert.equal(bad.status, 404);
  assert.match((await bad.json()).error, /^no exploration with id "999"; exploration ids are \d+(, \d+)*$/);
  const page = await open('/explore/abc');
  assert.equal(page.status, 404);
  assert.match(await page.text(), /no exploration with id &quot;abc&quot;; exploration ids are /);
});

test('Earlier lists the explorations newest first', async () => {
  const earlier = (await get('/data/explore')).earlier;
  assert.ok(earlier.length >= 3);
  assert.ok(earlier.every((x, i) => i === 0 || earlier[i - 1].id > x.id));
  assert.deepEqual(Object.keys(earlier[0]), ['id', 'question', 'created_at', 'error']);
});

test('opening a character or a group from an exploration writes an opens row with exploration and its id', async () => {
  const x = (await (await json('POST', '/explore', { question: QUESTION })).json()).exploration;
  await open(`/k/${encodeURIComponent('峠')}?kind=exploration&value=${x.id}`);
  assert.deepEqual(lastOpen(), { char: '峠', from_kind: 'exploration', from_value: String(x.id) });
  await open(`/g/radical/173?exploration=${x.id}`);
  const db = records();
  const row = db.prepare('SELECT char, from_kind, from_value, group_kind, group_value FROM opens ORDER BY rowid DESC LIMIT 1').get();
  db.close();
  assert.deepEqual({ ...row }, { char: '', from_kind: 'exploration', from_value: String(x.id), group_kind: 'radical', group_value: '173' });
});

test('opening a character from a theme writes an opens row with theme and its id; an unknown origin writes none', async () => {
  await open(`/k/${encodeURIComponent('鬱')}?kind=theme&value=most-strokes`);
  assert.deepEqual(lastOpen(), { char: '鬱', from_kind: 'theme', from_value: 'most-strokes' });
  await open(`/k/${encodeURIComponent('鬱')}?kind=theme&value=not-a-theme`);
  assert.deepEqual(lastOpen(), { char: '鬱', from_kind: null, from_value: null });
});
