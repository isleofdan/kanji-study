'use strict';
// Crash reporting (kanji-crash-one, from the starting kit): unexpected
// server errors go to Sentry, whose alert calls the Spine, which files one
// Wall card per issue. Required as the first line of server.js, so Sentry is
// set up before anything else loads.
//
// SENTRY_DSN unset or empty (npm test, a local run): @sentry/node is
// never loaded and captureException and flush do nothing. Set (fly.toml
// [env]): only the error and its code location are sent. The scrub the
// pages use (public/crash.js) keeps a short list of fields and drops the
// rest (request, user, contexts, modules, source lines, variables, the
// breadcrumbs that carry addresses or logs), and its SETTINGS turn off what
// Sentry 11 would otherwise gather.

const { scrub, SETTINGS } = require('../public/crash.js');

const DSN = (process.env.SENTRY_DSN || '').trim();
let Sentry = null;
// Object identity proves this came from captureTest, not caller-controlled fields.
// Weak membership survives asynchronous SDK processing without retaining errors.
const testErrors = new WeakSet();

if (DSN) {
  Sentry = require('@sentry/node');
  Sentry.init({ dsn: DSN, ...SETTINGS, beforeSend(event, hint) {
    const out = scrub(event);
    if (testErrors.has(hint && hint.originalException)) {
      out.fingerprint = ['kanji-study:server-crash-test:v1'];
    }
    return out;
  } });
}

function captureException(e) {
  if (Sentry) Sentry.captureException(e);
}

// Waits (at most `ms`) until what was captured has been sent.
async function flush(ms = 2000) {
  if (Sentry) await Sentry.flush(ms);
}

// Test-only receipt: no request values enter the error or response.
async function captureTest() {
  const correlationId = require('node:crypto').randomUUID();
  const receipt = { schema: 1, correlationId, captureId: null,
    outcome: 'disabled', sentryVerified: false };
  const error = new Error('crash-test: kanji study reports crashes [' + correlationId + ']');
  testErrors.add(error);
  console.error(error.stack);
  if (!Sentry) return receipt;
  try {
    const id = Sentry.captureException(error);
    if (typeof id === 'string' && /^[0-9a-f]{32}$/.test(id)) receipt.captureId = id;
  } catch { receipt.outcome = 'capture_failed'; return receipt; }
  let timer;
  try {
    receipt.outcome = await Promise.race([
      Promise.resolve().then(() => Sentry.flush(2000)).then(
        ok => ok === true ? 'sdk_flushed' : 'sdk_flush_incomplete',
        () => 'flush_failed'),
      new Promise(resolve => { timer = setTimeout(() => resolve('flush_timeout'), 2100); }),
    ]);
  } finally { clearTimeout(timer); }
  // A capture ID or drained SDK queue does not prove Sentry stored the event.
  return receipt;
}

module.exports = { captureTest, enabled: Boolean(Sentry), captureException, flush, scrub };
