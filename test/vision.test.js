'use strict';
// lib/vision.js with no OpenRouter key: it refuses before calling anything,
// with the line saying which.

const test = require('node:test');
const assert = require('node:assert');

test('with no key set, "Read it" answers the line naming the missing key and calls nothing', async () => {
  delete process.env.OPENROUTER_API_KEY;
  const upstream = require('../lib/upstream');
  const vision = require('../lib/vision');
  await assert.rejects(vision.read('drawn', 'data:image/png;base64,AAAA'), {
    status: 503,
    message: 'Could not read it: no OpenRouter key is set on the server (OPENROUTER_API_KEY).',
  });
  assert.equal(upstream.state().calls, 0);
});
