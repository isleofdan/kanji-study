// The service worker that makes the site installable as an app on the
// phone (kanji-three, after the Hebrew reader's). It keeps no copy of the
// app: every request goes to the server as it would without it, so the app
// is always the live site.
//
// The one thing it holds is a share in flight. Another app's share arrives
// as a POST navigation to /share (the share target in manifest.webmanifest,
// multipart/form-data, the picture under "photos" as MDN's example names
// it). The worker keeps its title, text, url and first picture in Cache
// storage under one fixed key, then sends the browser to /share, whose page
// reads the share, saves it, and removes it.
const SHARE_CACHE = 'kanji-share';
const HELD = '/share/held';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'POST' || e.request.mode !== 'navigate' || url.origin !== self.location.origin || url.pathname !== '/share') {
    return; /* the network answers, as always */
  }
  e.respondWith((async () => {
    const form = await e.request.formData();
    const held = new FormData();
    for (const k of ['title', 'text', 'url']) {
      const v = form.get(k);
      if (typeof v === 'string' && v.trim()) held.append(k, v);
    }
    const picture = form.getAll('photos').find((f) => typeof f !== 'string' && f.size > 0);
    if (picture) held.append('photos', picture, picture.name || 'shared');
    await (await caches.open(SHARE_CACHE)).put(HELD, new Response(held));
    return Response.redirect('/share', 303);
  })());
});
