// The service worker that makes the site installable as an app on the
// phone (kanji-three, after the Hebrew reader's). It keeps no copy of
// anything: every request goes to the server as it would without it, so the
// app is always the live site.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => { /* the network answers, as always */ });
