// Drives the app in a real browser and saves every screen at phone size
// (412×915) and computer size (1280×800), in light and in dark, into
// docs/reports/screenshots/. It signs in the way a person does: it opens
// the sign-in page and types the passphrase (with a space after it, as a
// phone keyboard adds) into the form. Never pre-supplied credentials. Along
// the way it checks no screen scrolls sideways, and that pressing Save and
// choosing a candidate keep their place on the screen.
//   npm run screenshots
// The model is the stand-in (scripts/mock-openrouter.mjs), never the real
// OpenRouter. Each size and scheme starts with empty records, so the first
// screen is the empty Catch page.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { crc32, deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'docs', 'reports', 'screenshots');
mkdirSync(out, { recursive: true });

const PORT = 8921;
const MOCK_PORT = 8941;
const PASS = 'open sesame';
const base = `http://127.0.0.1:${PORT}`;
const SIZES = { phone: { width: 412, height: 915 }, computer: { width: 1280, height: 800 } };
const SCHEMES = ['light', 'dark'];
// The screens, in the order the walk reaches them; each is saved as
// <name>-<size>-<scheme>.png.
const SCREENS = ['catch-empty', 'draw-read', 'char', 'group', 'catch-populated', 'yours', 'status'];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function up(url) {
  for (let i = 0; ; i++) {
    try { await fetch(url); return; } catch { if (i > 100) throw new Error(`${url} never answered`); await wait(50); }
  }
}

const mock = spawn('node', ['scripts/mock-openrouter.mjs', String(MOCK_PORT)], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] });
let server = null;
let dataDir = null;
process.on('exit', () => { mock.kill(); server?.kill(); if (dataDir) rmSync(dataDir, { recursive: true, force: true }); });

async function freshServer() {
  if (server) { server.kill(); await new Promise((r) => server.once('exit', r)); }
  if (dataDir) rmSync(dataDir, { recursive: true, force: true });
  dataDir = mkdtempSync(join(tmpdir(), 'kanji-shots-'));
  server = spawn('node', ['server.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(PORT), APP_PASSWORD: PASS, COOKIE_SECRET: 'x'.repeat(64), COOKIE_INSECURE: '1', DATA_DIR: dataDir,
      OPENROUTER_API_KEY: 'screenshot-key', OPENROUTER_URL: `http://127.0.0.1:${MOCK_PORT}/v1/chat/completions` },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  await up(`${base}/alive`);
}

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); if (!ok) failed++; };
const noSideways = async (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const top = async (locator) => Math.round((await locator.boundingBox()).y * 100) / 100;

// One stroke on the drawing pad, as a finger would.
async function stroke(page) {
  const pad = await page.locator('#pad').boundingBox();
  await page.mouse.move(pad.x + pad.width * 0.2, pad.y + pad.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(pad.x + pad.width * 0.8, pad.y + pad.height * 0.3, { steps: 8 });
  await page.mouse.move(pad.x + pad.width * 0.5, pad.y + pad.height * 0.8, { steps: 8 });
  await page.mouse.up();
}

// A small grey PNG of the given size, as a picked photo.
function png(width, height) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 0;
  const rows = Buffer.alloc((width + 1) * height, 0x90);
  for (let y = 0; y < height; y++) rows[y * (width + 1)] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}

await up(`http://127.0.0.1:${MOCK_PORT}/calls`);
const browser = await chromium.launch();
for (const [size, viewport] of Object.entries(SIZES)) {
  for (const scheme of SCHEMES) {
    await freshServer();
    const tag = `${size} ${scheme}`;
    const shot = async (page, name) => {
      check(`${tag}: ${name} fits the width`, await noSideways(page));
      await page.screenshot({ path: join(out, `${name}-${size}-${scheme}.png`), fullPage: true });
    };
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: size === 'phone', hasTouch: size === 'phone', colorScheme: scheme });
    const page = await context.newPage();

    await page.goto(`${base}/`);
    check(`${tag}: a stranger lands on sign-in`, new URL(page.url()).pathname === '/login');
    if (scheme === 'light') await page.screenshot({ path: join(out, `signin-${size}.png`) });
    await page.fill('#passphrase', 'wrong');
    await page.click('button[type=submit]');
    check(`${tag}: a wrong passphrase is refused on screen`, (await page.textContent('#msg')).includes('not right'));
    await page.fill('#passphrase', `${PASS} `);
    await page.click('button[type=submit]');
    await page.waitForURL(`${base}/`);
    check(`${tag}: the passphrase typed into the form signs in`, true);

    // Catch, empty.
    await page.waitForSelector('#loose-none:not([hidden])');
    const heights = await page.$$eval('.catch-buttons .btn', (bs) => bs.map((b) => b.getBoundingClientRect().height));
    check(`${tag}: the four catch buttons are each at least 56 px high`, heights.length === 4 && heights.every((h) => h >= 56), heights.join(', '));
    if (size === 'phone') {
      const widths = await page.$$eval('.catch-buttons .btn', (bs) => bs.map((b) => b.getBoundingClientRect().width));
      const full = await page.$eval('main', (m) => m.clientWidth - 32);
      check(`${tag}: the catch buttons are full width on the phone`, widths.every((w) => Math.abs(w - full) < 1), `${widths[0]} of ${full} px`);
    }
    await shot(page, 'catch-empty');

    // Draw, then "Read it": the stand-in answers 雨, 峠 and 龘; only the
    // first two are in the data.
    await page.click('[data-panel=draw]');
    await stroke(page);
    await page.fill('#where', 'film subtitles');
    await page.click('#draw-read');
    await page.waitForSelector('#draw-out .candidates');
    const candidates = await page.$$eval('#draw-out .candidates button', (bs) => bs.map((b) => b.textContent));
    check(`${tag}: "Read it" shows only the candidates in the data`, candidates.join('') === '雨峠', candidates.join(' '));
    await shot(page, 'draw-read');

    // Choosing a candidate: the result takes the list's place on the screen
    // (measured once the list is in view, as Dan would see it to tap).
    await page.locator('#draw-out .candidates button[data-char="雨"]').scrollIntoViewIfNeeded();
    const listTop = await top(page.locator('#draw-out .candidates'));
    await page.click('#draw-out .candidates button[data-char="雨"]');
    await page.waitForSelector('#draw-out [data-chosen="雨"]');
    const resultTop = await top(page.locator('#draw-out [data-chosen="雨"]'));
    check(`${tag}: choosing a candidate keeps its place`, Math.abs(resultTop - listTop) < 1, `candidates top ${listTop} px, result top ${resultTop} px, ${Math.abs(resultTop - listTop)} px apart`);

    // A note, kept as a loose end.
    await page.click('[data-panel=note]');
    await page.fill('#where', 'temple gate');
    await page.fill('#note-text', 'plaque at the temple gate, something with 雨 on top');
    await page.click('#note-keep');
    await page.waitForSelector('#loose li');

    // Type 峠, open it, press Save: the button becomes "Saved" in place.
    await page.click('[data-panel=type]');
    await page.fill('#typed', '峠');
    await page.click('#type-form button[type=submit]');
    await page.click('#type-out .candidates a');
    await page.waitForURL(/\/k\//);
    await page.waitForSelector('#save:not([disabled])');
    const saveTop = await top(page.locator('#save'));
    const before = await page.textContent('#save');
    await page.click('#save');
    await page.waitForSelector('#save.is-saved');
    const savedTop = await top(page.locator('#save'));
    const after = await page.textContent('#save');
    check(`${tag}: "Save" becomes "Saved" at the same height`, before === 'Save' && after === 'Saved' && savedTop === saveTop,
      `"${before}" top ${saveTop} px, "${after}" top ${savedTop} px, ${Math.abs(savedTop - saveTop)} px apart`);
    const facts = await page.textContent('#facts');
    check(`${tag}: the character page shows its facts`, ['常用漢字', '部首', '山 (46)', '画数', '訓読み', 'とうげ'].every((t) => facts.includes(t)));
    check(`${tag}: the character page names the data's source`, (await page.textContent('#source')).includes('KANJIDIC2'));
    await shot(page, 'char');

    // Its 部首 opens the group, with 峠 outlined.
    await page.click('#facts a[href^="/g/radical/"]');
    await page.waitForSelector('#chars li');
    const origin = await page.$$eval('#chars .origin', (as) => as.map((a) => a.textContent));
    check(`${tag}: the group page outlines the character he came from`, origin.join('') === '峠', origin.join(' '));
    check(`${tag}: the group heading says what they share`, (await page.textContent('#heading')) === '部首 山 (46)');
    check(`${tag}: his saved character is tinted in the group`, await page.$eval('#chars .origin', (a) => a.classList.contains('saved')));
    check(`${tag}: a group of 300 or fewer shows no "Show all"`, !(await page.isVisible('#show-all')));
    await shot(page, 'group');

    // A group of more than 300 shows the first 300, then all on "Show all".
    await page.goto(`${base}/g/list/joyo`);
    await page.waitForSelector('#chars li');
    const firstCount = await page.$$eval('#chars li', (l) => l.length);
    await page.click('#show-all');
    const allCount = await page.$$eval('#chars li', (l) => l.length);
    check(`${tag}: a group over 300 shows 300, then all on "Show all"`, firstCount === 300 && allCount === 2136, `${firstCount}, then ${allCount}`);

    // Catch, with a loose end and the latest.
    await page.goto(`${base}/`);
    await page.waitForSelector('#latest li');
    const latest = await page.$$eval('#latest a', (as) => as.map((a) => a.textContent));
    check(`${tag}: Latest shows the caught characters`, latest.includes('峠') && latest.includes('雨'), latest.join(' '));
    check(`${tag}: Loose ends shows the note`, (await page.textContent('#loose')).includes('plaque at the temple gate'));
    await shot(page, 'catch-populated');

    await page.click('header nav a[href="/yours"]');
    await page.waitForSelector('#yours li');
    const yours = await page.$$eval('#yours a', (as) => as.map((a) => a.textContent));
    check(`${tag}: Yours shows 峠 then 雨, newest first`, yours.join('') === '峠雨', yours.join(' '));
    await shot(page, 'yours');

    // Keep, then the next catch: Keep comes back, twice over, for Note,
    // Draw and Photo.
    await page.goto(`${base}/`);
    await page.waitForSelector('#loose li');
    const looseCount = async () => page.$$eval('#loose li', (l) => l.length);
    const startLoose = await looseCount();
    await page.click('[data-panel=note]');
    for (const note of ['first note: a menu, 鰆?', 'second note: the station sign']) {
      await page.fill('#note-text', note);
      check(`${tag}: Note's Keep is there for "${note.slice(0, 12)}"`, await page.isVisible('#note-keep'));
      await page.click('#note-keep');
      await page.waitForSelector('#note-out .say');
    }
    await page.click('[data-panel=draw]');
    for (let i = 0; i < 2; i++) {
      await stroke(page);
      check(`${tag}: Draw's Keep is there for drawing ${i + 1}`, await page.isVisible('#draw-keep'));
      await page.click('#draw-keep');
      await page.waitForSelector('#draw-out .say');
    }
    await page.click('[data-panel=photo]');
    for (let i = 0; i < 2; i++) {
      await page.setInputFiles('#photo-file', { name: `photo-${i}.png`, mimeType: 'image/png', buffer: png(320 + i, 240) });
      await page.waitForSelector('#photo-keep:not([disabled])');
      check(`${tag}: Photo's Keep is there for photo ${i + 1}`, await page.isVisible('#photo-keep'));
      await page.click('#photo-keep');
      await page.waitForSelector('#photo-out .say');
    }
    await page.waitForFunction((n) => document.querySelectorAll('#loose li').length === n, startLoose + 6);
    check(`${tag}: two notes, two drawings and two photos kept make six loose ends`, (await looseCount()) === startLoose + 6, `${startLoose} → ${await looseCount()}`);

    // Resolving a later loose end by typing: the result takes the place of
    // the candidates he tapped (rule 3).
    await page.reload();
    await page.waitForSelector('#loose li');
    const row = page.locator('#loose li').nth(2);
    await row.locator('.head').click();
    await row.locator('.open input').fill('鰆');
    await row.locator('.open button[type=submit]').click();
    await row.locator('.open .candidates').waitFor();
    await row.locator('.open .candidates button').first().scrollIntoViewIfNeeded();
    const looseListTop = await top(row.locator('.open .candidates'));
    await row.locator('.open .candidates button[data-char="鰆"]').click();
    await row.locator('[data-chosen="鰆"]').waitFor();
    const looseResultTop = await top(row.locator('[data-chosen="鰆"]'));
    check(`${tag}: resolving a later loose end keeps its place`, Math.abs(looseResultTop - looseListTop) < 1,
      `candidates top ${looseListTop} px, result top ${looseResultTop} px, ${Math.abs(looseResultTop - looseListTop)} px apart`);

    // A repeated catch of 峠, already saved: "Add this catch" resolves it
    // and becomes "Saved" in place; 峠 stays saved.
    await page.goto(`${base}/`);
    await page.click('[data-panel=type]');
    await page.fill('#typed', '峠');
    await page.click('#type-form button[type=submit]');
    await page.click('#type-out .candidates a');
    await page.waitForURL(/\/k\//);
    await page.waitForSelector('#save:not([disabled])');
    const addLabel = await page.textContent('#save');
    const addTop = await top(page.locator('#save'));
    await page.click('#save');
    await page.waitForSelector('#save.is-saved');
    const addedTop = await top(page.locator('#save'));
    const state = await page.evaluate(async () => ({
      yours: (await (await fetch('/data/yours', { headers: { accept: 'application/json' } })).json()).saved.map((s) => s.char),
      loose: (await (await fetch('/data/home', { headers: { accept: 'application/json' } })).json()).loose.filter((c) => c.kind === 'typed').length,
    }));
    check(`${tag}: a repeated catch of a saved character offers "Add this catch", then "Saved" in place`,
      addLabel === 'Add this catch' && (await page.textContent('#save')) === 'Saved' && addedTop === addTop, `"${addLabel}" top ${addTop} px, "Saved" top ${addedTop} px`);
    check(`${tag}: it stays saved and leaves no typed loose end`, state.yours.includes('峠') && state.loose === 0, `Yours ${state.yours.join(' ')}, typed loose ends ${state.loose}`);

    await page.goto(`${base}/status`);
    check(`${tag}: status shows "alive since"`, (await page.textContent('body')).includes('alive since '));
    await shot(page, 'status');
    await context.close();
  }
}
await browser.close();
const calls = await (await fetch(`http://127.0.0.1:${MOCK_PORT}/calls`)).json();
check('the stand-in model was asked once per "Read it" and no more', calls.calls === Object.keys(SIZES).length * SCHEMES.length, `${calls.calls} calls`);
console.log(failed ? `${failed} check(s) failed` : `all checks passed; ${SCREENS.length} screens × 2 sizes × 2 schemes in ${out}`);
process.exit(failed ? 1 : 0);
