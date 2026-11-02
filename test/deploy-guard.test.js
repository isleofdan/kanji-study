'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {context,preflight}=require('../scripts/deploy-guard.cjs');
const sha='a'.repeat(40),toml='SYNTHETIC CONFIG';
function fixture(){return {
 env:{GITHUB_REPOSITORY:'isleofdan/kanji-study',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REF:'refs/heads/main',GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:sha,EXPECTED_WORKFLOW_SHA:sha},
 target:{configurationReviewed:true,app:'kanji-study-dan',machine:'8654724c923dd8',volume:'vol_synthetic',flyctlVersion:'0.4.122',flyTomlSha256:crypto.createHash('sha256').update(toml).digest('hex')},
 machines:[{id:'8654724c923dd8',region:'nrt',state:'started',host_status:'ok',cordoned:false,checks:[{status:'passing'}],config:{metadata:{fly_process_group:'app'},mounts:[{volume:'vol_synthetic',path:'/data'}]}}],
 volumes:[{id:'vol_synthetic',name:'kanji_data',region:'nrt',state:'created',attached_machine_id:'8654724c923dd8',size_gb:1}],
 secrets:['APP_PASSWORD','OPENROUTER_API_KEY','COOKIE_SECRET'].map(name=>({name,status:'Deployed'}))};}
function run(f,custom){const calls=[];const read=args=>{calls.push(args);return custom?custom(args):JSON.stringify(f[args[0]==='machine'?'machines':args[0]]);};const result=preflight(f.env,f.target,toml,read);return {calls,result};}
test('normal existing resources; only three fixed read operations',()=>{const r=run(fixture());assert.equal(r.result,'EXISTING_RESOURCE_PREFLIGHT_PASSED');assert.deepEqual(r.calls,[['machine','list','--app','kanji-study-dan','--json'],['volumes','list','--app','kanji-study-dan','--json'],['secrets','list','--app','kanji-study-dan','--json']]);});
const mutations={
 'changed SHA': f=>f.env.GITHUB_SHA='b'.repeat(40),
 'abbreviated SHA':f=>f.env.EXPECTED_WORKFLOW_SHA='aaaaaaa',
 'malformed SHA':f=>f.env.EXPECTED_WORKFLOW_SHA=['a'.repeat(40)],
 'branch':f=>f.env.GITHUB_REF='refs/heads/other',
 'rerun':f=>f.env.GITHUB_RUN_ATTEMPT='2',
 'push':f=>f.env.GITHUB_EVENT_NAME='push',
 'wrong repo':f=>f.env.GITHUB_REPOSITORY='other/repo',
 'unreviewed config':f=>f.target.configurationReviewed=false,
 'wrong config digest':f=>f.target.flyTomlSha256='0'.repeat(64),
 'missing CLI pin':f=>f.target.flyctlVersion=null,
 'tag prefix is not setup version syntax':f=>f.target.flyctlVersion='v0.4.122',
 'missing volume pin':f=>f.target.volume=null,
 'target app mismatch':f=>f.target.app='other',
 'empty machine inventory':f=>f.machines=[],
 'null machines':f=>f.machines=null,
 'object machines':f=>f.machines={},
 'multiple machines':f=>f.machines.push(structuredClone(f.machines[0])),
 'null machine':f=>f.machines=[null],
 'wrong machine':f=>f.machines[0].id='wrong',
 'machine region':f=>f.machines[0].region='lax',
 'machine stopped':f=>f.machines[0].state='stopped',
 'unreachable host':f=>f.machines[0].host_status='unreachable',
 'cordoned':f=>f.machines[0].cordoned=true,
 'missing health':f=>delete f.machines[0].checks,
 'empty health':f=>f.machines[0].checks=[],
 'failed health':f=>f.machines[0].checks[0].status='critical',
 'bad health type':f=>f.machines[0].checks=[null],
 'missing config':f=>delete f.machines[0].config,
 'wrong mount':f=>f.machines[0].config.mounts[0].path='/other',
 'wrong volume mount':f=>f.machines[0].config.mounts[0].volume='vol_other',
 'multiple mounts':f=>f.machines[0].config.mounts.push({}),
 'empty volumes':f=>f.volumes=[],
 'wrong process group':f=>f.machines[0].config.metadata.fly_process_group='other',
 'changed size':f=>f.volumes[0].size_gb=2,
 'malformed volumes':f=>f.volumes='error',
 'multiple volumes':f=>f.volumes.push(structuredClone(f.volumes[0])),
 'wrong volume ID':f=>f.volumes[0].id='vol_other',
 'wrong volume name':f=>f.volumes[0].name='kanji_data_backup',
 'wrong volume region':f=>f.volumes[0].region='lax',
 'unattached volume':f=>f.volumes[0].attached_machine_id=null,
 'creating volume':f=>f.volumes[0].state='creating',
 'bad size':f=>f.volumes[0].size_gb='1',
 'bad volume host':f=>f.volumes[0].host_status='unknown',
 'empty secrets':f=>f.secrets=[],
 'missing key':f=>f.secrets.pop(),
 'null secrets':f=>f.secrets=null,
 'duplicate secret':f=>f.secrets.push(f.secrets[0]),
 'missing status':f=>delete f.secrets[0].status,
 'unknown status':f=>f.secrets[0].status='Unknown',
 'staged secret':f=>f.secrets[0].status='Staged',
 'partial secret':f=>f.secrets[0].status='Partial',
 'extra staged secret':f=>f.secrets.push({name:'OTHER',status:'Staged'}),
 'malformed name':f=>f.secrets[0].name=['APP_PASSWORD'],
};
for(const [name,change]of Object.entries(mutations))test('reject '+name,()=>{const f=fixture();change(f);assert.throws(()=>run(f));});
test('commit failure precedes all inventory calls',()=>{const f=fixture();f.env.GITHUB_SHA='b'.repeat(40);let calls=0;assert.throws(()=>run(f,()=>{calls++;return '[]';}),/COMMIT_MISMATCH/);assert.equal(calls,0);});
for(const which of ['machine','volumes','secrets'])for(const kind of ['error','malformed','empty'])test(which+' '+kind+' fails closed without revealing data',()=>{const f=fixture();assert.throws(()=>run(f,args=>{if(args[0]===which){if(kind==='error')throw Error('SYNTHETIC_PRIVATE');return kind==='malformed'?'SYNTHETIC_PRIVATE':'';}return JSON.stringify(f[args[0]==='machine'?'machines':args[0]]);}),e=>/^(INVENTORY_COMMAND_FAILED|INVENTORY_JSON_INVALID)$/.test(e.message));});
test('extra deployed secret is preserved, not replaced',()=>{const f=fixture();f.secrets.push({name:'OTHER',status:'Deployed'});assert.equal(run(f).result,'EXISTING_RESOURCE_PREFLIGHT_PASSED');});
test('technically reviewed target still rejects different source bytes',()=>{const f=fixture(),target=require('../scripts/deploy-target.json');assert.equal(target.configurationReviewed,true);assert.throws(()=>context(f.env,target,toml),/CONFIG_SOURCE_CHANGED/);});
