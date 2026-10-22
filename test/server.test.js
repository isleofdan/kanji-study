'use strict';
// The gate, the alive line and the status page, against a real server.
//   npm test

const test = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const path = require('node:path');
const app = require('../lib/app');
const { COOKIE } = require('../lib/auth');

const PORT = 8911;
const PASS = 'open sesame';
const base = `http://127.0.0.1:${PORT}`;
let server;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function up() {
  for (let i = 0; i < 100; i++) { try { await fetch(`${base}/alive`); return; } catch { await wait(50); } }
  throw new Error('server never answered');
}
const form = (fields) => ({ method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields).toString() });

test.before(async () => {
  server = spawn('node', ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(PORT), APP_PASSWORD: PASS, COOKIE_SECRET: 'x'.repeat(64), COOKIE_INSECURE: '1', COMMIT: 'abcdef1234' },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  await up();
});
test.after(() => server.kill());

test('the alive line answers 200 in plain text without a cookie', async () => {
  const r = await fetch(`${base}/alive`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /^text\/plain/);
  assert.match(await r.text(), /^alive since \d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ · abcdef1\n$/);
});

test('the status page and the sample screen send a stranger to sign-in', async () => {
  for (const p of ['/status', '/']) {
    const r = await fetch(`${base}${p}`, { redirect: 'manual' });
    assert.equal(r.status, 303, p);
    assert.equal(r.headers.get('location'), `/login?next=${encodeURIComponent(p)}`);
  }
});

test('the sign-in page is a form, never the browser\'s password box', async () => {
  const r = await fetch(`${base}/login`);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('www-authenticate'), null);
  const html = await r.text();
  assert.match(html, /<form class="login" method="post" action="\/login">/);
  assert.match(html, /name="viewport"/);
});

test('a wrong passphrase is refused and sets no cookie', async () => {
  const r = await fetch(`${base}/login`, form({ passphrase: 'open sesame!', next: '/' }));
  assert.equal(r.status, 401);
  assert.equal(r.headers.get('set-cookie'), null);
  assert.match(await r.text(), /That passphrase is not right/);
});

test('the right passphrase with spaces around it signs in for 30 days', async () => {
  const before = Date.now();
  const r = await fetch(`${base}/login`, form({ passphrase: `  ${PASS} \n`, next: '/status' }));
  assert.equal(r.status, 303);
  assert.equal(r.headers.get('location'), '/status');
  const cookie = r.headers.get('set-cookie');
  assert.match(cookie, /Max-Age=2592000/);
  const expires = Date.parse(/Expires=([^;]+)/.exec(cookie)[1]);
  const days = (expires - before) / 86400000;
  assert.ok(days > 29.99 && days < 30.01, `expiry ${days} days out`);
  const jar = cookie.split(';')[0];
  const status = await fetch(`${base}/status`, { headers: { cookie: jar } });
  assert.equal(status.status, 200);
  const html = await status.text();
  assert.match(html, /alive since .* · abcdef1/);
  assert.match(html, /Nothing called yet\./);
  const home = await fetch(`${base}/`, { headers: { cookie: jar } });
  assert.match(await home.text(), new RegExp(`This is ${app.title}`));
});

test('a forged cookie is refused', async () => {
  const r = await fetch(`${base}/status`, { redirect: 'manual', headers: { cookie: `${COOKIE}=${Date.now() + 1e9}.deadbeef` } });
  assert.equal(r.status, 303);
});

test('a sign-in may only send the browser to a page on this site', async () => {
  const r = await fetch(`${base}/login`, form({ passphrase: PASS, next: '//evil.example/' }));
  assert.equal(r.headers.get('location'), '/');
});
