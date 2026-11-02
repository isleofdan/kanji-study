'use strict';
// Server-only outbound policy. Error events have already passed beforeSend.
// Reports retain only bounded aggregate error-loss diagnostics, never identity.
const REASONS = new Set(['before_send', 'callback_error', 'event_processor',
  'network_error', 'queue_overflow', 'ratelimit_backoff', 'sample_rate',
  'send_error', 'internal_sdk_error', 'buffer_overflow', 'ignored', 'invalid',
  'no_parent_span']);
const record = x => x !== null && typeof x === 'object' && !Array.isArray(x) &&
  (Object.getPrototypeOf(x) === Object.prototype || Object.getPrototypeOf(x) === null);

function permittedEnvelope(envelope, now = Date.now() / 1000) {
  if (!Array.isArray(envelope) || envelope.length !== 2 || !record(envelope[0]) ||
      !Array.isArray(envelope[1]) || envelope[1].length !== 1) return null;
  const item = envelope[1][0];
  if (!Array.isArray(item) || item.length !== 2 || !record(item[0]) || !record(item[1])) return null;
  // No attachments, sessions, logs, metrics, transactions or mixed envelopes.
  // Preserve the existing SDK error envelope and its existing scrub unchanged.
  if (item[0].type === 'event') return envelope;
  if (item[0].type !== 'client_report') return null;
  const { timestamp, discarded_events: entries } = item[1];
  if (!Number.isFinite(now) || !Number.isFinite(timestamp) || timestamp < 946684800 ||
      timestamp > 4102444800 || timestamp < now - 300 || timestamp > now + 60 ||
      !Array.isArray(entries) || entries.length < 1 || entries.length > 128) return null;
  const seen = new Set(), counts = [];
  for (const entry of entries) {
    // SDK reports can mix categories. Exclude other/unknown categories entirely.
    if (!record(entry) || entry.category !== 'error') continue;
    if (!REASONS.has(entry.reason) ||
        !Number.isSafeInteger(entry.quantity) || entry.quantity < 1 || entry.quantity > 1000000 ||
        seen.has(entry.reason)) return null;
    seen.add(entry.reason);
    counts.push({ reason: entry.reason, category: 'error', quantity: entry.quantity });
  }
  if (!counts.length) return null;
  // Reports need no envelope ID, SDK/user metadata, routing DSN or item extras.
  return [{}, [[{ type: 'client_report' }, {
    timestamp: Math.floor(timestamp / 60) * 60, discarded_events: counts,
  }]]];
}

function guardedTransport(makeTransport) {
  return options => {
    const transport = makeTransport(options);
    return {
      send(envelope) {
        const allowed = permittedEnvelope(envelope);
        // Do not create a new outcome here: that could recursively report drops.
        return allowed ? transport.send(allowed) : Promise.resolve({});
      },
      flush: timeout => transport.flush(timeout),
    };
  };
}

module.exports = { permittedEnvelope, guardedTransport };
