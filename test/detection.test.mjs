import {test} from 'node:test';
import assert from 'node:assert/strict';
import {detect} from '../src/detect.mjs';
const start=Date.UTC(2026,9,1);
const read=(offset,sub='fixture')=>({at:new Date(start+offset).toISOString(),method:'GET',identity:{sub}});
test('rolling window handles unsorted data, exact boundary, user separation and non-read events',()=>{
 const base=Array.from({length:120},()=>read(0));
 assert.deepEqual(detect(base),{action:'observe'});
 assert.deepEqual(detect([read(600000),...base].reverse()),{action:'propose_revocation',reasonCode:'burst_read',subject:'fixture'});
 assert.deepEqual(detect([...base,read(600001)]),{action:'observe'});
 assert.deepEqual(detect([...base,read(0,'other')]),{action:'observe'});
 assert.deepEqual(detect([...base,{...read(0),method:'POST'}]),{action:'observe'});
 assert.deepEqual(detect([...base,{at:'invalid',method:'GET',identity:{sub:'fixture'}}]),{action:'observe'});
 assert.deepEqual(detect([{at:'invalid',method:'GET'},null]),{action:'observe'});
 assert.throws(()=>detect(null),TypeError);
});
