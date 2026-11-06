import assert from 'node:assert/strict';
import {test} from 'node:test';
import {generateKeyPair,exportJWK,createLocalJWKSet,SignJWT} from 'jose';
import {createLoginVerifier} from '../src/verify-login.mjs';
import {createNotesHandler} from '../src/notes-handler.mjs';
import config from '../aleph.config.json' with {type:'json'};
const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const RUN='33333333-3333-4333-8333-333333333333';
const {privateKey,publicKey}=await generateKeyPair('ES256');
const jwk=await exportJWK(publicKey);jwk.kid='local-fixture';
const verify=createLoginVerifier({config,judgeKeySet:createLocalJWKSet({keys:[jwk]}),supabaseClient:{auth:{getClaims:async()=>({error:{message:'not a live student session'}})}}});
async function token(overrides={},key=privateKey){
 const now=Math.floor(Date.now()/1000);
 return new SignJWT({iss:config.judgeIssuer,aud:new URL(config.publicAppUrl).hostname,sub:A,aleph_run:RUN,aleph_role:'judge',aleph_identity:'a',iat:now,exp:now+300,...overrides}).setProtectedHeader({alg:'ES256',kid:'local-fixture'}).sign(key);
}
const response=()=>({headers:{},status(code){this.code=code;return this;},json(body){this.body=body;},setHeader(k,v){this.headers[k]=v;}});
test('provided verifier rejects missing, forged, expired and wrong-audience tokens',async()=>{
 assert.equal(await verify(),null);
 assert.equal(await verify('Bearer invalid'),null);
 const valid=await token();assert.equal((await verify(`Bearer ${valid}`)).userId,A);
 assert.equal(await verify(`Bearer ${await token({aud:'other.vercel.app'})}`),null);
 assert.equal(await verify(`Bearer ${await token({iat:1,exp:2})}`),null);
 const foreign=await generateKeyPair('ES256');assert.equal(await verify(`Bearer ${await token({},foreign.privateKey)}`),null);
});
test('CRUD uses verified identity and preserves exact note route contract',async()=>{
 const rows=new Map();
 const project=({id,title,body})=>({id,title,body});
 const handler=createNotesHandler({verify,store:{
  list:async owner=>[...rows.values()].filter(n=>n.owner_id===owner).map(project),
  get:async(id,owner)=>rows.get(id)?.owner_id===owner?project(rows.get(id)):null,
  create:async note=>rows.set(note.id,note),
  update:async(id,fields,owner)=>{if(rows.get(id)?.owner_id!==owner)return null;rows.set(id,{...rows.get(id),...fields});return project(rows.get(id));},
  remove:async(id,owner)=>rows.get(id)?.owner_id===owner&&rows.delete(id),
 }});
 const authorization=`Bearer ${await token()}`;
 const call=async(method,id,body,auth=authorization)=>{const res=response();await handler({method,query:id?{id}:{},body,headers:{authorization:auth}},res);return res;};
 const denied=await call('POST',null,{title:'fixture',body:'fixture'},null);assert.equal(denied.code,401);
 const unauth=response();await handler({method:'GET',query:{},headers:{}},unauth);assert.equal(unauth.code,401);
 assert.equal((await call('POST',null,{title:'fixture',body:'fictional',owner_id:B})).code,403);
 const created=await call('POST',null,{title:'fixture',body:'fictional',userId:B,role:'admin'});
 assert.equal(created.code,201);const id=created.body.id;assert.equal(rows.get(id).owner_id,A);
 assert.deepEqual((await call('GET',id)).body,{id,title:'fixture',body:'fictional'});
 assert.equal((await call('PUT',id,{title:'edited',body:'changed',owner_id:B})).code,403);assert.equal(rows.get(id).owner_id,A);
 const bAuth=`Bearer ${await token({sub:B,aleph_identity:'b'})}`;
 for(const method of ['GET','PUT','DELETE']) assert.equal((await call(method,id,{title:'intrusion',body:'fixture'},bAuth)).code,404);
 assert.deepEqual((await call('GET',null,null,bAuth)).body,[]);
 assert.equal(rows.get(id).body,'fictional');
 const bCreated=await call('POST',null,{title:'B fixture',body:'fictional'},bAuth);assert.equal(bCreated.code,201);
 assert.equal(rows.get(bCreated.body.id).owner_id,B);
 assert.equal((await call('GET',bCreated.body.id)).code,404);
 assert.equal((await call('GET',bCreated.body.id,null,bAuth)).code,200);
 assert.equal((await call('PUT',bCreated.body.id,{title:'B edit',body:'fixture'},bAuth)).code,200);
 assert.equal((await call('DELETE',bCreated.body.id,null,bAuth)).code,200);
 assert.equal((await call('PUT',id,{title:'edited',body:'changed'})).code,200);
 assert.equal((await call('GET')).body.some(n=>n.id===id),true);
 assert.equal((await call('DELETE',id)).code,200);assert.equal((await call('GET',id)).code,404);
 assert.equal((await call('GET','bad-id')).code,400);
 assert.equal((await call('POST',null,{title:'',body:'x'})).code,400);
});
