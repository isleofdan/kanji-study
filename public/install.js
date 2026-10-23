'use strict';
// Makes the site installable as an app on the phone (kanji-three), so other
// apps can share text or a picture into it. The service worker keeps
// nothing: the app is the live site.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => { /* the site works the same without it */ }); });
}
