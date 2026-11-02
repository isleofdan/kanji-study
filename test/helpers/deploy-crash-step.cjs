'use strict';
const assert = require('node:assert/strict');
// Deliberately scoped to this repository's existing six-space workflow steps.
// Unknown formatting fails rather than selecting some later run block.
function deployCrashStep(yml) {
  const steps = yml.split(/(?=^      - )/m);
  const found = steps.map((s,i) => /^        id: crash_test_once\s*$/m.test(s) ? i : -1).filter(i => i >= 0);
  const signIn = steps.map((s,i) => /^      - name: Sign in through the sign-in form\s*$/m.test(s) ? i : -1).filter(i => i >= 0);
  assert.equal(found.length, 1, 'exactly one crash_test_once step');
  assert.equal(signIn.length, 1, 'exactly one sign-in step');
  assert.ok(found[0] > signIn[0], 'crash step after the sign-in step');
  const block = steps[found[0]];
  assert.match(block, /^        run: \|\s*$/m, 'crash step owns a shell body');
  return block;
}
module.exports = { deployCrashStep };
