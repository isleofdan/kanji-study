// The installed app's icons (kanji-three, after the Hebrew reader's): the
// character 字, white on the app's accent (--accent in public/app.css),
// drawn by the local browser into public/icon-192.png and
// public/icon-512.png. The glyph stays inside the middle 80%, so an Android
// launcher's round mask never cuts it.
//   FONTCONFIG_FILE=<a fonts.conf with a Japanese font> node scripts/make-icons.mjs
// Without a Japanese font the browser draws a box: look at the two PNGs.
import { chromium } from 'playwright';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ACCENT = '#2f6f4f';
const browser = await chromium.launch();
for (const size of [192, 512]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<html lang="ja"><body style="margin:0"><div style="width:${size}px;height:${size}px;background:${ACCENT};display:flex;align-items:center;justify-content:center">
    <span id="g" style="font-family:'Noto Sans JP','Noto Sans CJK JP',sans-serif;font-size:${Math.round(size * 0.5)}px;color:#ffffff;line-height:1">字</span></div></body></html>`);
  await page.evaluate(() => document.fonts.ready);
  // The glyph's box must sit inside the middle 80% (the mask's safe zone).
  const box = await page.locator('#g').boundingBox();
  const lo = size * 0.1;
  const hi = size * 0.9;
  if (box.x < lo || box.y < lo || box.x + box.width > hi || box.y + box.height > hi) throw new Error(`字 at ${size} px leaves the middle 80%: ${JSON.stringify(box)}`);
  await page.screenshot({ path: join(root, 'public', `icon-${size}.png`) });
  await page.close();
}
await browser.close();
console.log('icons written: public/icon-192.png, public/icon-512.png');
