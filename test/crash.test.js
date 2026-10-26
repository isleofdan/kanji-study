'use strict';
// Crash reporting (lib/crash.js, public/crash.js, public/sentry.min.js):
// off with no DSN, the scrub both sides share, the pages, the bundle, the
// /crash-test route, the deploy step, and, with a DSN pointing at a
// stand-in for Sentry in this process, what actually leaves the server.
// Adapted from the starting kit's test/crash.test.js (kanji-crash-one).
//   npm test

const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const vm = require('node:vm');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { gunzipSync } = require('node:zlib');

const root = path.join(__dirname, '..');
const PUBLIC = path.join(root, 'public');
const PASS = 'open sesame';
const PAGES = fs.readdirSync(PUBLIC).filter((f) => f.endsWith('.html')).sort();
// The records go to an empty folder of the test's own, never ./var.
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'kanji-crash-test-'));
test.after(() => fs.rmSync(DATA_DIR, { recursive: true, force: true }));

// With no DSN in this process, lib/crash.js is required before anything else.
delete process.env.SENTRY_DSN;
const crash = require('../lib/crash');
const page = require('../public/crash.js');
const app = require('../lib/app');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function start(port, env = {}) {
  const kid = spawn('node', ['server.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), APP_PASSWORD: PASS, COOKIE_SECRET: 'x'.repeat(64), COOKIE_INSECURE: '1', DATA_DIR, SENTRY_DSN: '', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  kid.log = '';
  kid.stdout.on('data', (d) => { kid.log += d; });
  kid.stderr.on('data', (d) => { kid.log += d; });
  return kid;
}
async function up(base) {
  for (let i = 0; i < 100; i++) { try { await fetch(`${base}/alive`); return; } catch { await wait(50); } }
  throw new Error(`nothing answered at ${base}`);
}
async function signIn(base) {
  const r = await fetch(`${base}/login`, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ passphrase: PASS, next: '/' }).toString() });
  return r.headers.get('set-cookie').split(';')[0];
}

const exception = { values: [{ type: 'Error', value: 'boom', stacktrace: { frames: [{ filename: '/app/server.js', function: 'handle', lineno: 12 }] } }] };
const crumbs = () => ['http', 'fetch', 'xhr', 'console', 'navigation', 'ui.click', 'ui.input', 'sentry.event', 'custom']
  .map((category) => ({ category, message: `${category}: /notes?q=private` }));
const event = () => ({
  event_id: 'e1', level: 'error', exception: structuredClone(exception), server_name: 'machine-1',
  request: { url: 'https://proof-app-dan.fly.dev/notes?q=private', headers: { cookie: 'proof_app_auth=x' }, data: '{"note":"private"}' },
  user: { ip_address: '1.2.3.4', id: 'dan' }, transaction: 'GET /notes/private', extra: { arguments: [{ target: 'private' }] }, breadcrumbs: crumbs(),
});

test('with no SENTRY_DSN, lib/crash.js loads no Sentry module and its functions do nothing', async () => {
  const loaded = Object.keys(require.cache).filter((k) => k.includes(path.join('node_modules', '@sentry')));
  assert.equal(crash.enabled, false);
  assert.deepEqual(loaded, []);
  assert.equal(typeof crash.captureException, 'function');
  assert.equal(typeof crash.flush, 'function');
  assert.equal(crash.captureException(new Error('nothing to send')), undefined);
  assert.equal(await crash.flush(10), undefined);
});

test('the scrub drops the request, user, transaction, extra, server name and the telling breadcrumbs, and keeps the exception', () => {
  assert.equal(crash.scrub, page.scrub, 'the server scrubs with the pages\' function');
  const out = page.scrub(event());
  for (const k of ['request', 'user', 'transaction', 'extra', 'server_name']) assert.ok(!(k in out), k);
  assert.deepEqual(out.breadcrumbs.map((b) => b.category), ['sentry.event', 'custom']);
  assert.deepEqual(out.exception, exception);
  assert.equal(out.event_id, 'e1');
  assert.equal(out.level, 'error');
  const older = page.scrub({ exception: structuredClone(exception), breadcrumbs: { values: crumbs() } });
  assert.deepEqual(older.breadcrumbs.values.map((b) => b.category), ['sentry.event', 'custom'], 'the { values } shape too');
  assert.deepEqual(page.scrub({ exception: structuredClone(exception) }), { exception });
});

test('the scrub strips the query and fragment from stack frame paths, keeping file, line and column', () => {
  const out = page.scrub({
    exception: { values: [{ type: 'Error', value: 'inline', stacktrace: { frames: [
      { filename: 'https://proof-app-dan.fly.dev/index.html?id=3&q=private#top', abs_path: 'https://proof-app-dan.fly.dev/notes?q=private', module: 'notes?q=x', lineno: 92, colno: 7, function: 'go' },
      { filename: '/app/server.js', lineno: 600, colno: 3 }] } }] },
    threads: { values: [{ stacktrace: { frames: [{ filename: 'https://proof-app-dan.fly.dev/status?x=1', lineno: 1 }] } }] },
  });
  const [f0, f1] = out.exception.values[0].stacktrace.frames;
  assert.deepEqual(f0, { filename: 'https://proof-app-dan.fly.dev/index.html', abs_path: 'https://proof-app-dan.fly.dev/notes', module: 'notes', lineno: 92, colno: 7, function: 'go' });
  assert.deepEqual(f1, { filename: '/app/server.js', lineno: 600, colno: 3 });
  assert.ok(!('threads' in out), 'threads are dropped');
});

test('the scrub keeps only its short list: no source lines, local variables, contexts, modules, tags or other fields', () => {
  const out = page.scrub({
    event_id: 'e2', timestamp: 1, level: 'error', platform: 'node', environment: 'production', release: 'r1',
    sdk: { name: 'sentry.javascript.node', version: '11', integrations: ['ContextLines'], packages: [{ name: 'npm:@sentry/node' }] },
    contexts: { os: { name: 'Linux' }, device: { memory_size: 1 }, culture: { timezone: 'Asia/Tokyo' }, app: { app_start_time: 'x' } },
    modules: { '@sentry/node': '11' }, tags: { note: 'private' }, fingerprint: ['x'], logentry: { message: 'private' },
    exception: { values: [{ type: 'Error', value: 'boom', module: 'm', thread_id: 1,
      mechanism: { type: 'generic', handled: true, data: { private: 'x' } },
      stacktrace: { frames: [{ filename: '/app/server.js', function: 'go', lineno: 9, colno: 2, in_app: true,
        pre_context: ['const secret = "private-source";'], context_line: 'throw e', post_context: ['}'], vars: { note: 'private-var' }, instruction_addr: '0x1' }] } }] },
  });
  assert.deepEqual(out, {
    event_id: 'e2', timestamp: 1, level: 'error', platform: 'node', environment: 'production', release: 'r1',
    sdk: { name: 'sentry.javascript.node', version: '11' },
    exception: { values: [{ type: 'Error', value: 'boom', mechanism: { type: 'generic', handled: true },
      stacktrace: { frames: [{ filename: '/app/server.js', function: 'go', lineno: 9, colno: 2, in_app: true }] } }] },
  });
});

test('both sides pass Sentry.init the same settings: production, no personal data, no server name, no tracing, no replay, the scrub', () => {
  const S = page.SETTINGS;
  assert.equal(S.environment, 'production');
  assert.equal(S.sendDefaultPii, false);
  assert.equal(S.includeServerName, false);
  assert.equal(S.tracesSampleRate, 0);
  assert.equal(S.replaysSessionSampleRate, 0);
  assert.equal(S.replaysOnErrorSampleRate, 0);
  assert.equal(S.beforeSend, page.scrub);
  assert.equal(S.includeLocalVariables, false);
  assert.deepEqual(S.dataCollection, {
    userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false,
    graphQL: { document: false, variables: false }, genAI: { inputs: false, outputs: false }, mcp: { inputs: false, outputs: false },
    databaseQueryData: false, queues: false, stackFrameVariables: false, frameContextLines: 0,
  }, 'Sentry 11 gathers all of these unless told not to');
  // every option Sentry 11 knows is set, so a new default that gathers more shows up here
  const { resolveDataCollectionOptions } = require(path.join(root, 'node_modules', '@sentry', 'core', 'build', 'cjs', 'utils', 'data-collection', 'resolveDataCollectionOptions.js'));
  assert.deepEqual(Object.keys(resolveDataCollectionOptions({})).sort(), Object.keys(S.dataCollection).sort());
  const kept = S.integrations(['ContextLines', 'LocalVariables', 'LocalVariablesAsync', 'Context', 'CultureContext', 'Modules', 'Dedupe', 'LinkedErrors'].map((name) => ({ name })));
  assert.deepEqual(kept.map((i) => i.name), ['Dedupe', 'LinkedErrors'], 'the integrations that gather source, variables, contexts and modules are skipped');
});

test('in a page, crash.js starts Sentry only when the page carries a DSN and the bundle', () => {
  const src = fs.readFileSync(path.join(PUBLIC, 'crash.js'), 'utf8');
  const inPage = (dsn, withSdk = true) => {
    const inits = [];
    const window = withSdk ? { Sentry: { init: (o) => inits.push(o) } } : {};
    const document = { querySelector: (q) => (q === 'meta[name="sentry-dsn"]' && dsn ? { getAttribute: (a) => (a === 'content' ? dsn : null) } : null) };
    vm.runInNewContext(src, { window, document });
    return inits;
  };
  const inits = inPage('http://key@127.0.0.1:1/1');
  assert.equal(inits.length, 1);
  assert.equal(inits[0].dsn, 'http://key@127.0.0.1:1/1');
  assert.equal(inits[0].sendDefaultPii, false);
  assert.equal(inits[0].beforeSend(event()).request, undefined);
  assert.equal(inPage('').length, 0, 'no DSN: nothing');
  assert.doesNotThrow(() => inPage('http://key@127.0.0.1:1/1', false), 'a DSN but no bundle: nothing, and no throw');
});

test('every page in public/ loads /sentry.min.js then /crash.js before its own scripts, all from its own paths', () => {
  assert.equal(PAGES.length, 11, PAGES.join());
  for (const f of PAGES) {
    const html = fs.readFileSync(path.join(PUBLIC, f), 'utf8');
    const srcs = [...html.matchAll(/<script\b([^>]*)>/g)].map((m) => (/src="([^"]*)"/.exec(m[1]) || [, '(inline)'])[1]);
    assert.deepEqual(srcs.slice(0, 2), ['/sentry.min.js', '/crash.js'], f);
    assert.equal(srcs.filter((s) => s === '/crash.js').length, 1, f);
    assert.deepEqual(srcs.filter((s) => s !== '(inline)' && !s.startsWith('/')), [], `${f} loads a script from another site`);
    assert.ok(!/<script\b[^>]*src="\/(sentry\.min|crash)\.js"[^>]*\b(defer|async)\b/.test(html), `${f}: the crash scripts run before deferred ones`);
  }
});

test('the committed public/sentry.min.js is what `npm run build` makes, and exposes only init and captureException', async () => {
  const { sentryBundle } = await import('../scripts/build-sentry.mjs');
  const committed = fs.readFileSync(path.join(PUBLIC, 'sentry.min.js'), 'utf8');
  assert.ok(committed === await sentryBundle(), 'public/sentry.min.js differs from a fresh build: run npm run build and commit');
  const win = {};
  win.window = win; win.self = win; win.globalThis = win;
  vm.runInNewContext(committed, win);
  assert.deepEqual(Object.keys(win.Sentry || {}).sort(), ['captureException', 'init']);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.match(pkg.dependencies['@sentry/node'], /^\^11\./);
  assert.match(pkg.dependencies['@sentry/browser'], /^\^11\./);
  assert.deepEqual(Object.keys(pkg.dependencies).sort(), ['@sentry/browser', '@sentry/node', 'better-sqlite3']);
  assert.equal(pkg.scripts.build, 'node scripts/build-sentry.mjs');
});

test('with no DSN: the crash files answer signed out, pages carry no DSN, and POST /crash-test is 303 to sign-in signed out (401 for JSON) and 500 signed in', async (t) => {
  const port = 8915, base = `http://127.0.0.1:${port}`;
  const kid = start(port);
  t.after(() => kid.kill());
  await up(base);
  for (const p of ['/sentry.min.js', '/crash.js']) {
    const r = await fetch(`${base}${p}`, { redirect: 'manual' });
    assert.equal(r.status, 200, p);
    assert.match(r.headers.get('content-type'), /^text\/javascript/, p);
    assert.equal(await r.text(), fs.readFileSync(path.join(PUBLIC, p), 'utf8'), p);
  }
  assert.ok(!(await (await fetch(`${base}/login`)).text()).includes('sentry-dsn'));
  const out = await fetch(`${base}/crash-test`, { method: 'POST', redirect: 'manual' });
  assert.equal(out.status, 303);
  assert.equal(out.headers.get('location'), '/login?next=%2Fcrash-test');
  const asJson = await fetch(`${base}/crash-test`, { method: 'POST', redirect: 'manual', headers: { accept: 'application/json' } });
  assert.equal(asJson.status, 401);
  assert.deepEqual(await asJson.json(), { error: 'sign in first' });
  const cookie = await signIn(base);
  const r = await fetch(`${base}/crash-test`, { method: 'POST', headers: { cookie, accept: 'application/json' } });
  assert.equal(r.status, 500);
  assert.deepEqual(await r.json(), { error: 'something went wrong on the server' });
  assert.equal((await fetch(`${base}/crash-test`, { headers: { cookie } })).status, 404, 'only POST');
  await wait(100);
  assert.match(kid.log, /Error: crash-test: kanji study reports crashes/, 'the catch still logs the error');
});

test('with a DSN, pages carry it, and a crash reaches Sentry with its message and code location and nothing of the request', async (t) => {
  const envelopes = [];
  const sentry = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      let body = Buffer.concat(chunks);
      if (/gzip/i.test(req.headers['content-encoding'] || '')) body = gunzipSync(body);
      envelopes.push(body.toString('utf8'));
      res.end('{}');
    });
  }).listen(0, '127.0.0.1');
  await new Promise((r) => sentry.once('listening', r));
  const dsn = `http://publickey@127.0.0.1:${sentry.address().port}/1`;
  const port = 8916, base = `http://127.0.0.1:${port}`;
  const kid = start(port, { SENTRY_DSN: dsn });
  t.after(() => { kid.kill(); sentry.close(); });
  await up(base);
  const login = await (await fetch(`${base}/login`)).text();
  assert.ok(login.includes(`<head>\n<meta name="sentry-dsn" content="${dsn}">`), 'the DSN right after <head>');
  const cookie = await signIn(base);
  assert.ok((await (await fetch(`${base}/status`, { headers: { cookie } })).text()).includes(`<meta name="sentry-dsn" content="${dsn}">`));
  const r = await fetch(`${base}/crash-test?q=private-word#top`, { method: 'POST', headers: { cookie, 'content-type': 'application/json', accept: 'application/json' }, body: '{"note":"private-body"}' });
  assert.equal(r.status, 500);
  for (let i = 0; i < 50 && !envelopes.some((e) => e.includes('"type":"event"')); i++) await wait(100);
  const events = envelopes.filter((e) => e.includes('"type":"event"'));
  assert.equal(events.length, 1, `${events.length} events`);
  const item = JSON.parse(events[0].split('\n')[2]);
  const ex = item.exception.values[0];
  assert.equal(ex.type, 'Error');
  assert.equal(ex.value, 'crash-test: kanji study reports crashes');
  assert.ok(ex.stacktrace.frames.some((f) => /server\.js$/.test(f.filename || '')), 'a frame in server.js');
  assert.equal(item.environment, 'production');
  for (const k of ['request', 'user', 'transaction', 'extra', 'server_name', 'contexts', 'modules', 'tags', 'threads']) assert.ok(!(k in item), k);
  for (const k of Object.keys(item)) assert.ok(['event_id', 'timestamp', 'level', 'platform', 'environment', 'release', 'sdk', 'exception', 'breadcrumbs'].includes(k), `sent: ${k}`);
  for (const f of ex.stacktrace.frames) for (const k of Object.keys(f)) assert.ok(['filename', 'abs_path', 'module', 'function', 'lineno', 'colno', 'in_app'].includes(k), `a frame sent ${k}`);
  const text = envelopes.join('\n');
  // a line of server.js just above the throw: source context would carry it
  assert.ok(!text.includes('crash reaches Sentry'), 'source lines were sent');
  for (const s of ['pre_context', 'context_line', 'post_context', '"vars"', '"os"', '"device"', '"culture"', 'cloud_resource']) assert.ok(!text.includes(s), `sent: ${s}`);
  for (const s of ['private-word', 'private-body', '?q=', '_auth', 'kanji-crash-test-', cookie.split('=')[1], `${app.name} on`]) assert.ok(!text.includes(s), `sent: ${s}`);
  if (os.hostname().length >= 6) assert.ok(!text.includes(os.hostname()), 'the machine\'s name was sent');
  assert.deepEqual(envelopes.filter((e) => !e.includes('"type":"event"')).map((e) => e.split('\n')[1]), [], 'nothing else is sent');
  assert.match(kid.log, /Error: crash-test: kanji study reports crashes/, 'the catch still logs the error');
});

test('the deploy\'s "Check a crash reaches Sentry" step warns, never fails, when the crash test does not answer 500', () => {
  const yml = fs.readFileSync(path.join(root, '.github', 'workflows', 'deploy.yml'), 'utf8');
  const at = yml.indexOf('- name: Check a crash reaches Sentry');
  assert.ok(at > yml.indexOf('- name: Sign in through the sign-in form'), 'after the sign-in step');
  const lines = yml.slice(at).split('\n');
  const from = lines.findIndex((l) => /^\s+run: \|\s*$/.test(l));
  const run = [];
  for (const l of lines.slice(from + 1)) { if (l.trim() && !l.startsWith('          ')) break; run.push(l.slice(10)); }
  assert.equal((run.join('\n').match(/--max-time \d+/g) || []).length, 2, 'both requests bounded in time');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kanji-crash-step-'));
  try {
    fs.writeFileSync(path.join(dir, 'step.sh'), run.join('\n'));
    // a stand-in curl: the code -w would print, or 000 and exit 7 (could not connect)
    fs.writeFileSync(path.join(dir, 'curl'), `#!/bin/bash
case "$*" in *"/login"*) what=login ;; *"/crash-test"*) what=test ;; *) what=other ;; esac
if [ "$FAKE_DOWN" = "$what" ]; then printf 000; exit 7; fi
[ "$what" = login ] && printf 303 || printf "\${FAKE_CODE:-500}"
`);
    fs.chmodSync(path.join(dir, 'curl'), 0o755);
    const step = (env) => {
      const tmp = fs.mkdtempSync(path.join(dir, 'tmp-'));
      const r = spawnSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', path.join(dir, 'step.sh')], { encoding: 'utf8', env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, APP: 'kanji-dan', APP_PASSWORD: 'x', TMPDIR: tmp, ...env } });
      return { status: r.status, out: r.stdout + r.stderr, left: fs.readdirSync(tmp).length };
    };
    const ok = step({});
    assert.equal(ok.status, 0, ok.out);
    assert.match(ok.out, /sign-in form: HTTP 303\ncrash-test: 500\n/);
    assert.ok(!ok.out.includes('::warning::'), ok.out);
    for (const [env, want] of [[{ FAKE_DOWN: 'login' }, 'crash-test: 000'], [{ FAKE_DOWN: 'test' }, 'crash-test: 000'], [{ FAKE_CODE: '303' }, 'crash-test: 303']]) {
      const r = step(env);
      assert.equal(r.status, 0, r.out);
      assert.ok(r.out.includes(want) && r.out.includes('::warning::'), r.out);
      assert.equal(r.left, 0, 'the cookie jar is removed');
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
