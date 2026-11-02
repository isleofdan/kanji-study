'use strict';
const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'),path=require('node:path');
const {deployCrashStep}=require('./helpers/deploy-crash-step.cjs');
const yml=fs.readFileSync(path.join(__dirname,'../.github/workflows/deploy.yml'),'utf8');
test('stable ID locates the actual authenticated single crash step regardless of display label',()=>{
  const block=deployCrashStep(yml.replace('One approved crash POST (HTTP observation only)','Accurate replacement label'));
  assert.equal((block.match(/-X POST/g)||[]).length,1);
  assert.equal((block.match(/--data-urlencode "passphrase=/g)||[]).length,1);
  assert.match(block,/if \[ "\$login" = "303" \]; then/);
  assert.match(block,/-b "\$jar" -X POST/);
  assert.equal((block.match(/--max-time 30/g)||[]).length,2);
});
test('missing crash step fails',()=>assert.throws(()=>deployCrashStep(yml.replace('        id: crash_test_once','        id: something_else')),/exactly one crash_test_once/));
test('crash step moved before login fails',()=>{
  const block=deployCrashStep(yml);
  const changed=yml.replace(block,'').replace('      - name: Sign in through the sign-in form',block+'\n      - name: Sign in through the sign-in form');
  assert.throws(()=>deployCrashStep(changed),/after the sign-in step/);
});
test('missing sign-in step fails',()=>assert.throws(()=>deployCrashStep(yml.replace('      - name: Sign in through the sign-in form','      - name: Missing sign-in')),/exactly one sign-in/));
test('duplicate crash ID fails',()=>assert.throws(()=>deployCrashStep(yml+'\n      - name: Duplicate\n        id: crash_test_once\n        run: |\n          true\n'),/exactly one crash_test_once/));
test('missing crash body cannot borrow a later step body',()=>{
  const block=deployCrashStep(yml),changed=yml.replace(block,block.replace('        run: |','        missing: |'))+'\n      - name: Later\n        run: |\n          true\n';
  assert.throws(()=>deployCrashStep(changed),/owns a shell body/);
});
