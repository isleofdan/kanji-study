'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { permittedEnvelope, guardedTransport } = require('../lib/crash-envelope');
const now = 1800000001;
const good = () => [{}, [[{type:'client_report'}, {timestamp:now,
  discarded_events:[{reason:'network_error', category:'error', quantity:2}]}]]];

test('client reports are reconstructed to minimal aggregate fields', () => {
  const x=good();x[0]={event_id:'PRIVATE',dsn:'PRIVATE',sdk:{name:'PRIVATE'}};
  x[1][0][0].filename='PRIVATE';x[1][0][1].user={id:'PRIVATE'};
  x[1][0][1].discarded_events[0].message='PRIVATE';
  assert.deepEqual(permittedEnvelope(x,now), [{},[[{type:'client_report'},
    {timestamp:1800000000,discarded_events:[{reason:'network_error',category:'error',quantity:2}]}]]]);
  assert(!JSON.stringify(permittedEnvelope(x,now)).includes('PRIVATE'));
});
test('malformed report structures and scalar types fail closed', () => {
  for(const x of [null,{},[],[{},[]],[{},[[{type:'client_report'},null]]],
    [{},[[{type:'client_report'},'PRIVATE']]], [...good(), 'PRIVATE']]) assert.equal(permittedEnvelope(x,now),null);
  for(const timestamp of [NaN,Infinity,-Infinity,'1800000001',null,now-301,now+61,0,4102444801]){
    const x=good();x[1][0][1].timestamp=timestamp;assert.equal(permittedEnvelope(x,now),null);
  }
  for(const quantity of [0,-1,1.1,NaN,Infinity,'2',null,1000001,Number.MAX_SAFE_INTEGER]){
    const x=good();x[1][0][1].discarded_events[0].quantity=quantity;assert.equal(permittedEnvelope(x,now),null);
  }
  for(const entries of [null,{},[],Array(129).fill(good()[1][0][1].discarded_events[0])]){
    const x=good();x[1][0][1].discarded_events=entries;assert.equal(permittedEnvelope(x,now),null);
  }
  const x=good();x[1][0][1].discarded_events[0].reason='PRIVATE';assert.equal(permittedEnvelope(x,now),null);
});
test('unknown categories and session/activity counts are excluded even in mixed reports', () => {
  for(const category of ['session','transaction','span','PRIVATE',{},null]){
    const x=good();x[1][0][1].discarded_events.unshift({reason:'network_error',category,quantity:9});
    assert.equal(permittedEnvelope(x,now)[1][0][1].discarded_events.length,1);
    x[1][0][1].discarded_events.pop();assert.equal(permittedEnvelope(x,now),null);
  }
  const x=good();x[1][0][1].discarded_events.push({...x[1][0][1].discarded_events[0]});assert.equal(permittedEnvelope(x,now),null);
});
test('unknown envelope items and mixed envelopes never reach transport', async () => {
  const sent=[];let flushed;
  const factory=guardedTransport(options=>{assert.equal(options.marker,1);return{send:e=>{sent.push(e);return Promise.resolve({statusCode:200});},flush:ms=>{flushed=ms;return Promise.resolve(true);}};});
  const transport=factory({marker:1});
  for(const type of ['sessions','session','attachment','transaction','log','metric','PRIVATE'])await transport.send([{},[[{type},{data:'PRIVATE'}]]]);
  const mixed=good();mixed[1].push([{type:'event'},{exception:{values:[]}}]);await transport.send(mixed);
  assert.equal(sent.length,0);
  const report=good();report[1][0][1].timestamp=Date.now()/1000;await transport.send(report);
  assert.equal(sent.length,1);assert.deepEqual(sent[0][0],{});
  const event=[{event_id:'a'.repeat(32)},[[{type:'event'},{exception:{values:[{value:'ordinary'}]}}]]];
  await transport.send(event);assert.equal(sent[1],event);
  assert.equal(await transport.flush(123),true);assert.equal(flushed,123);
});
