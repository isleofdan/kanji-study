'use strict';
// lib/upstream.js keeps the last failure of an outside call, with the
// service's own status and message.

const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const upstream = require('../lib/upstream');

test('nothing called yet, then a failure is kept verbatim', async () => {
  assert.deepEqual(upstream.state(), { calls: 0, lastError: null });
  const stub = http.createServer((req, res) => {
    if (req.url === '/ok') return res.end('fine');
    res.writeHead(402, { 'content-type': 'application/json' });
    res.end('{"error":{"message":"Insufficient credits"}}');
  }).listen(0);
  const port = stub.address().port;
  const ok = await upstream.call('Stub', `http://127.0.0.1:${port}/ok`);
  assert.equal(ok.status, 200);
  assert.equal(upstream.state().lastError, null);
  const bad = await upstream.call('Stub', `http://127.0.0.1:${port}/pay`);
  assert.equal(bad.status, 402);
  assert.equal(await bad.text(), '{"error":{"message":"Insufficient credits"}}');
  const { calls, lastError } = upstream.state();
  assert.equal(calls, 2);
  assert.equal(lastError.service, 'Stub');
  assert.equal(lastError.status, 402);
  assert.equal(lastError.message, '{"error":{"message":"Insufficient credits"}}');
  stub.close();
  await assert.rejects(upstream.call('Gone', `http://127.0.0.1:${port}/`));
  assert.equal(upstream.state().lastError.service, 'Gone');
  assert.equal(upstream.state().lastError.status, null);
  assert.match(upstream.state().lastError.message, /^no answer: /);
});
