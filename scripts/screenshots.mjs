// Drives the app in a real browser and saves every screen at phone size
// (412×915) and computer size (1280×800) into docs/reports/screenshots/.
// It signs in the way a person does: it opens the sign-in page and types
// the passphrase (with a space after it, as a phone keyboard adds) into the
// form. Never pre-supplied credentials. Along the way it checks no screen
// scrolls sideways.
//   npm run screenshots
// An app adds its own screens to SCREENS.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'docs', 'reports', 'screenshots');
mkdirSync(out, { recursive: true });

const PORT = 8921;
const PASS = 'open sesame';
const base = `http://127.0.0.1:${PORT}`;
const SIZES = { phone: { width: 412, height: 915 }, computer: { width: 1280, height: 800 } };
const SCREENS = [
  { name: 'sample', path: '/', expect: 'This is ' },
  { name: 'status', path: '/status', expect: 'alive since ' },
];

const server = spawn('node', ['server.js'], {
  cwd: root,
  env: { ...process.env, PORT: String(PORT), APP_PASSWORD: PASS, COOKIE_SECRET: 'x'.repeat(64), COOKIE_INSECURE: '1' },
  stdio: ['ignore', 'ignore', 'inherit'],
});
process.on('exit', () => server.kill());
for (let i = 0; ; i++) {
  try { await fetch(`${base}/alive`); break; } catch { if (i > 100) throw new Error('server never answered'); await new Promise((r) => setTimeout(r, 50)); }
}

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); if (!ok) failed++; };
const noSideways = async (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

const browser = await chromium.launch();
for (const [size, viewport] of Object.entries(SIZES)) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: size === 'phone', hasTouch: size === 'phone' });
  const page = await context.newPage();

  await page.goto(`${base}/`);
  check(`${size}: a stranger lands on sign-in`, new URL(page.url()).pathname === '/login');
  await page.screenshot({ path: join(out, `signin-${size}.png`) });
  check(`${size}: sign-in fits the width`, await noSideways(page));

  await page.fill('#passphrase', 'wrong');
  await page.click('button[type=submit]');
  check(`${size}: a wrong passphrase is refused on screen`, (await page.textContent('#msg')).includes('not right'));

  await page.fill('#passphrase', `${PASS} `);
  await page.click('button[type=submit]');
  await page.waitForURL(`${base}/`);
  check(`${size}: the passphrase typed into the form signs in`, true);

  for (const s of SCREENS) {
    await page.goto(`${base}${s.path}`);
    const text = await page.textContent('body');
    check(`${size}: ${s.name} shows "${s.expect.trim()}"`, text.includes(s.expect));
    check(`${size}: ${s.name} fits the width`, await noSideways(page));
    await page.screenshot({ path: join(out, `${s.name}-${size}.png`) });
  }
  await context.close();
}
await browser.close();
console.log(failed ? `${failed} check(s) failed` : `all checks passed; screenshots in ${out}`);
process.exit(failed ? 1 : 0);
