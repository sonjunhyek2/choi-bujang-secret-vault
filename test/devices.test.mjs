import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDeviceHandler,createDeviceGate} from '../src/device-approval.mjs';
import {createNotesHandler} from '../src/notes-handler.mjs';
import config from '../aleph.config.json' with {type:'json'};
const principal={kind:'student',userId:'11111111-1111-4111-8111-111111111111'};
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},getHeader(k){return this.headers[k];},status(code){this.code=code;return this;},json(body){this.body=body;}});
test('request cannot approve itself; server-approved state is bound to owner, revocable and required at API',async()=>{
 const rows=new Map();
 const store={read:async(owner,hash)=>rows.get(`${owner}:${hash}`),request:async(owner,hash)=>{const key=`${owner}:${hash}`;if(!rows.has(key))rows.set(key,{status:'pending'});return rows.get(key);}};
 const gate=createDeviceGate({store});
 const handler=createDeviceHandler({verify:async auth=>auth==='fixture'?principal:null,store});
 const call=async(action,method,cookie,body)=>{const r=response();await handler({method,query:{action},headers:{authorization:'fixture',origin:config.publicAppUrl,cookie},body},r);return r;};
 assert.equal(await gate({headers:{}},principal),false);
 const request=await call('request','POST',undefined,{status:'approved',role:'admin'});
 assert.equal(request.code,202);assert.equal(request.body.status,'pending');
 const cookie=request.headers['Set-Cookie'][0].split(';')[0];
 assert.ok(request.headers['Set-Cookie'][0].includes('HttpOnly'));
 assert.equal((await call('status','GET',cookie)).body.status,'pending');assert.equal(await gate({headers:{cookie}},principal),false);
 const row=[...rows.values()][0];row.status='approved'; // Separate trusted operator, never a client field.
 assert.equal((await call('status','GET',cookie)).body.status,'approved');assert.equal(await gate({headers:{cookie}},principal),true);
 assert.equal(await gate({headers:{cookie}},{...principal,userId:'22222222-2222-4222-8222-222222222222'}),false);
 let reads=0;
 const notes=createNotesHandler({verify:async()=>principal,authorize:gate,store:{list:async()=>{reads++;return [];}}});
 const r=response();await notes({method:'GET',headers:{},query:{}},r);assert.equal(r.code,403);assert.equal(reads,0);
 const approved=response();await notes({method:'GET',headers:{cookie},query:{}},approved);assert.equal(approved.code,200);assert.equal(reads,1);
 row.status='revoked';const revoked=response();await notes({method:'GET',headers:{cookie},query:{}},revoked);assert.equal(revoked.code,403);assert.equal(reads,1);
});
