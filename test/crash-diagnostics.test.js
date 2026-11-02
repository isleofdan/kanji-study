'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const http=require('node:http'),{spawn}=require('node:child_process');
const {gunzipSync}=require('node:zlib');
const path=require('node:path');

test('real SDK synthetic delivery-loss report is permitted; unknown/session envelopes are blocked', {timeout:15000}, async t=>{
  const received=[];
  const receiver=http.createServer((req,res)=>{
    const chunks=[];req.on('data',c=>chunks.push(c));req.on('end',()=>{
      let bytes=Buffer.concat(chunks);if(/gzip/i.test(req.headers['content-encoding']||''))bytes=gunzipSync(bytes);
      received.push(bytes.toString('utf8'));res.end('{}');
    });
  });
  await new Promise(resolve=>receiver.listen(0,'127.0.0.1',resolve));
  t.after(()=>receiver.close());
  const script=`
    require('./lib/crash');
    const Sentry=require('@sentry/node');
    (async()=>{
      const client=Sentry.getClient();
      if(client.getOptions().sendClientReports!==true)throw Error('diagnostics disabled');
      if(client.getOptions().integrations.some(i=>i.name==='ProcessSession'))throw Error('process sessions enabled');
      client.recordDroppedEvent('network_error','error',2);
      client.recordDroppedEvent('sample_rate','span',9);
      if(!await Sentry.flush(2000))throw Error('first flush incomplete');
      await client.sendEnvelope([{event_id:'PRIVATE',sdk:{name:'PRIVATE'}},[[{type:'client_report',extra:'PRIVATE'},
        {timestamp:Date.now()/1000,user:{id:'PRIVATE'},discarded_events:[{reason:'queue_overflow',category:'error',quantity:3,message:'PRIVATE'}]}]]]);
      await client.sendEnvelope([{},[[{type:'sessions'},{aggregates:[{exited:123,started:'PRIVATE'}]}]]]);
      await client.sendEnvelope([{},[[{type:'attachment'},{data:'PRIVATE'}]]]);
      await client.sendEnvelope([{},[[{type:'client_report'},{timestamp:Date.now()/1000,discarded_events:[{reason:'PRIVATE',category:'error',quantity:1}]}]]]);
      if(!await Sentry.close(2000))throw Error('close incomplete');
      console.log('SYNTHETIC_DIAGNOSTIC_CHECK_COMPLETE');
    })().catch(()=>{console.error('SYNTHETIC_DIAGNOSTIC_CHECK_FAILED');process.exitCode=1;});`;
  const child=spawn(process.execPath,['-e',script],{
    cwd:path.join(__dirname,'..'),
    env:{SENTRY_DSN:'http://synthetic@127.0.0.1:'+receiver.address().port+'/1',SENTRY_RELEASE:'synthetic-release'},
    stdio:['ignore','pipe','pipe'],
  });
  t.after(()=>child.kill());let stdout='',stderr='';child.stdout.on('data',x=>stdout+=x);child.stderr.on('data',x=>stderr+=x);
  const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);});
  assert.equal(code,0,'synthetic SDK child must exit cleanly');assert.match(stdout,/SYNTHETIC_DIAGNOSTIC_CHECK_COMPLETE/);
  assert(!stderr.includes('SYNTHETIC_DIAGNOSTIC_CHECK_FAILED'));
  assert.equal(received.length,2,'only the two permitted reports reach loopback, including close/flush');
  const payloads=received.map(raw=>{
    assert(!raw.includes('PRIVATE'));const lines=raw.trim().split('\n');assert.equal(lines.length,3);
    const [head,item,payload]=lines.map(JSON.parse);assert.deepEqual(head,{});assert.deepEqual(item,{type:'client_report'});
    assert.deepEqual(Object.keys(payload).sort(),['discarded_events','timestamp']);
    assert.ok(Number.isSafeInteger(payload.timestamp)&&payload.timestamp%60===0);
    assert.ok(payload.timestamp>=Date.now()/1000-360&&payload.timestamp<=Date.now()/1000+60);
    return payload;
  });
  assert.deepEqual(payloads[0].discarded_events,[{reason:'network_error',category:'error',quantity:2}]);
  assert.deepEqual(payloads[1].discarded_events,[{reason:'queue_overflow',category:'error',quantity:3}]);
  // Deliberately print only synthetic, fixed diagnostic fixtures and field names.
  console.log('SDK_DIAGNOSTIC_SCHEMA: headers={}, item={type:client_report}, payload={timestamp:minute,discarded_events:[reason,category,quantity]}; network_error/error/2; queue_overflow/error/3; sessions=0; unknown=0');
});
