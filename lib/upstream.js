'use strict';
// Every call the app makes to anything outside itself (a model, a speech
// service, another app) goes through call(), so the status page can show
// the last failure with that service's own status and message, and Dan can
// read the reason on screen without a terminal. In memory only: a restart
// starts at "nothing called yet". The kit itself calls nothing.
//
//   const upstream = require('./lib/upstream');
//   const res = await upstream.call('OpenRouter', url, { method: 'POST', ... });
//
// call() returns fetch's Response as it came (the caller still checks
// res.ok); a status of 400 or more, or a failure to answer at all, is
// recorded before returning or throwing. The idea comes from
// isleofdan/miwa-english's lib/speech.js, which keeps OpenRouter's status
// and body verbatim.

const BODY_MAX = 2000;

let calls = 0;
let lastError = null; // { service, at, status, message }

function record(service, status, message) {
  lastError = { service, at: new Date().toISOString(), status, message: String(message).slice(0, BODY_MAX) };
}

async function call(service, url, options = {}) {
  calls += 1;
  let res;
  try {
    res = await fetch(url, options);
  } catch (e) {
    record(service, null, `no answer: ${e.cause?.message || e.message}`);
    throw e;
  }
  if (res.status >= 400) {
    const body = await res.clone().text().catch(() => '');
    record(service, res.status, body || res.statusText || '(empty answer)');
  }
  return res;
}

function state() {
  return { calls, lastError };
}

module.exports = { call, record, state };
