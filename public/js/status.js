// Status, "On the phone": two lines from this browser. Whether the service
// worker is registered (what makes the app installable from Chrome's menu),
// and whether the app's description (/manifest.webmanifest) lets other apps
// share to it. Read here, in plain words; nothing is counted or kept.
'use strict';

const line = (id, text) => { document.getElementById(id).textContent = text; };

(async () => {
  if (!('serviceWorker' in navigator)) return line('phone-install', 'Not installable here: this browser offers no service worker on this page (it needs a secure https address).');
  try {
    // The same registration install.js makes; asking again answers the
    // existing one, or the reason the browser gives for refusing it.
    await navigator.serviceWorker.register('/sw.js');
    line('phone-install', "The app can be installed from Chrome's menu");
  } catch (e) {
    line('phone-install', `Not installable here: ${e.message || 'the worker did not register'}`);
  }
})();

(async () => {
  let m;
  try {
    const res = await fetch('/manifest.webmanifest');
    m = await res.json();
  } catch {
    return line('phone-share', 'Other apps cannot share to Kanji here: the app\'s description could not be read.');
  }
  const t = m.share_target;
  if (!t || t.action !== '/share') return line('phone-share', 'Other apps cannot share to Kanji: the app\'s description lists no sharing.');
  const pictures = (t.params?.files || []).some((f) => [].concat(f.accept).some((a) => a === 'image/jpeg' || a === 'image/png'));
  line('phone-share', `Other apps can share text and links${pictures ? ', and PNG or JPEG pictures,' : ''} to Kanji: it is listed under "Share" once installed.`);
})();
