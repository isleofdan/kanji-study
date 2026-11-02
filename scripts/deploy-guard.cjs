'use strict';
// Read-only preflight. Never prints inventory, digests, environment or CLI stderr.
const fs = require('node:fs');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const APP = 'kanji-study-dan';
const MACHINE = '8654724c923dd8';
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const requireThat = (ok, code) => { if (!ok) throw new Error(code); };
function context(env, target, flyToml) {
  requireThat(env.GITHUB_REPOSITORY === 'isleofdan/kanji-study' && env.GITHUB_EVENT_NAME === 'workflow_dispatch' && env.GITHUB_REF === 'refs/heads/main' && env.GITHUB_RUN_ATTEMPT === '1', 'INVOCATION_REJECTED');
  requireThat(typeof env.EXPECTED_WORKFLOW_SHA === 'string' && /^[a-f0-9]{40}$/.test(env.EXPECTED_WORKFLOW_SHA) && env.GITHUB_SHA === env.EXPECTED_WORKFLOW_SHA, 'COMMIT_MISMATCH');
  requireThat(object(target) && target.configurationReviewed === true && target.app === APP && target.machine === MACHINE && typeof target.volume === 'string' && /^vol_[a-z0-9]+$/.test(target.volume) && typeof target.flyctlVersion === 'string' && /^\d+\.\d+\.\d+$/.test(target.flyctlVersion), 'TARGET_NOT_REVIEWED');
  requireThat(typeof target.flyTomlSha256 === 'string' && /^[a-f0-9]{64}$/.test(target.flyTomlSha256) && crypto.createHash('sha256').update(flyToml).digest('hex') === target.flyTomlSha256, 'CONFIG_SOURCE_CHANGED');
}
function inventory(machines, volumes, secrets, target) {
  requireThat(Array.isArray(machines) && machines.length === 1 && object(machines[0]), 'MACHINE_INVENTORY');
  const m = machines[0];
  requireThat(m.id === MACHINE && m.region === 'nrt' && m.state === 'started' && m.host_status === 'ok' && m.cordoned === false, 'MACHINE_STATE');
  requireThat(Array.isArray(m.checks) && m.checks.length > 0 && m.checks.every(c => object(c) && c.status === 'passing'), 'MACHINE_HEALTH');
  requireThat(object(m.config) && Array.isArray(m.config.mounts) && m.config.mounts.length === 1 && object(m.config.mounts[0]) && m.config.mounts[0].volume === target.volume && m.config.mounts[0].path === '/data', 'MOUNT_MISMATCH');
  requireThat(object(m.config.metadata) && m.config.metadata.fly_process_group === 'app', 'MACHINE_STATE');
  requireThat(Array.isArray(volumes) && volumes.length === 1 && object(volumes[0]), 'VOLUME_INVENTORY');
  const v = volumes[0];
  requireThat(v.id === target.volume && v.name === 'kanji_data' && v.region === 'nrt' && v.state === 'created' && v.attached_machine_id === MACHINE && v.size_gb === 1 && (v.host_status === undefined || v.host_status === 'ok'), 'VOLUME_STATE');
  requireThat(Array.isArray(secrets) && secrets.length >= 3 && secrets.every(s => object(s) && typeof s.name === 'string' && /^[A-Z][A-Z0-9_]*$/.test(s.name) && s.status === 'Deployed'), 'SECRET_INVENTORY');
  const names = secrets.map(s => s.name);
  requireThat(new Set(names).size === names.length && ['APP_PASSWORD','OPENROUTER_API_KEY','COOKIE_SECRET'].every(n => names.includes(n)), 'REQUIRED_SECRET_NAMES');
  // Even unrelated staged/unknown secrets above abort: deploying would apply them.
}
function preflight(env, target, flyToml, read) {
  context(env, target, flyToml);
  const query = args => {
    let text;
    try { text = read(args); } catch { throw new Error('INVENTORY_COMMAND_FAILED'); }
    try { return JSON.parse(text); } catch { throw new Error('INVENTORY_JSON_INVALID'); }
  };
  const machines = query(['machine','list','--app',APP,'--json']);
  const volumes = query(['volumes','list','--app',APP,'--json']);
  const secrets = query(['secrets','list','--app',APP,'--json']);
  inventory(machines, volumes, secrets, target);
  return 'EXISTING_RESOURCE_PREFLIGHT_PASSED';
}
if (require.main === module) {
  try {
    const target = JSON.parse(fs.readFileSync('scripts/deploy-target.json','utf8'));
    const flyToml = fs.readFileSync('fly.toml');
    if (process.argv[2] === 'context') { context(process.env,target,flyToml); console.log('INVOCATION_BOUND'); }
    else if (process.argv[2] === 'inventory') {
      console.log(preflight(process.env,target,flyToml,args => execFileSync('flyctl',args,{encoding:'utf8',timeout:30000,maxBuffer:1024*1024,stdio:['ignore','pipe','pipe']})));
    } else throw new Error('MODE_REJECTED');
  } catch (e) {
    const safe = ['INVOCATION_REJECTED','COMMIT_MISMATCH','TARGET_NOT_REVIEWED','CONFIG_SOURCE_CHANGED','MACHINE_INVENTORY','MACHINE_STATE','MACHINE_HEALTH','MOUNT_MISMATCH','VOLUME_INVENTORY','VOLUME_STATE','SECRET_INVENTORY','REQUIRED_SECRET_NAMES','INVENTORY_COMMAND_FAILED','INVENTORY_JSON_INVALID','MODE_REJECTED'];
    console.error(safe.includes(e.message) ? e.message : 'PREFLIGHT_FAILED'); process.exitCode = 1;
  }
}
module.exports = {context,inventory,preflight};
