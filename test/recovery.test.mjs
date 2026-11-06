import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRestoreHandler,noteDigest,RECOVERY_TEST_NOTE_ID} from '../src/recovery.mjs';
const owner='22222222-2222-4222-8222-222222222222';
const snapshot={id:RECOVERY_TEST_NOTE_ID,owner_id:owner,title:'B fixture',body:'fictional unicode 🐾',created_at:'2026-11-06T00:00:00Z'};
snapshot.content_hash=noteDigest(snapshot);
const response=()=>({setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;}});
test('single-note restore checks ownership and integrity, recovers edits/deletion and preserves others and audit',async()=>{
 const rows=new Map([[snapshot.id,{...snapshot,body:'changed'}],['other',{id:'other',body:'preserved'}]]);
 const audit=['previous'];let corrupt=false;
 const handler=createRestoreHandler({verify:async auth=>auth==='B'?{kind:'judge',identity:'b',userId:owner}:auth==='A'?{kind:'judge',identity:'a',userId:'11111111-1111-4111-8111-111111111111'}:null,store:{
   backup:async(id,who)=>id===snapshot.id&&who===owner?{...snapshot,...(corrupt?{body:'corrupt'}:{})}:null,
   restore:async(id,who,hash)=>{assert.equal(hash,snapshot.content_hash);assert.equal(who,owner);rows.set(id,{...snapshot});audit.push(id);return rows.get(id);},
 }});
 const call=async(method,auth,id=snapshot.id)=>{const res=response();await handler({method,headers:{authorization:auth},query:{},body:{id}},res);return res;};
 assert.equal((await call('POST')).code,401);assert.equal((await call('POST','A')).code,403);
 assert.equal((await call('GET','B')).body.content_hash,snapshot.content_hash);assert.equal(audit.length,1);
 assert.equal((await call('POST','B')).code,200);assert.equal(noteDigest(rows.get(snapshot.id)),snapshot.content_hash);
 rows.delete(snapshot.id);assert.equal((await call('POST','B')).code,200);
 assert.equal(noteDigest(rows.get(snapshot.id)),snapshot.content_hash);assert.equal(rows.get('other').body,'preserved');assert.equal(audit[0],'previous');
 assert.equal((await call('POST','B','33333333-3333-4333-8333-333333333333')).code,404);
 corrupt=true;assert.equal((await call('POST','B')).code,409);assert.equal(audit.length,3);
});
