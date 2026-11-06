import assert from 'node:assert/strict';
import {test} from 'node:test';
import {SignJWT} from 'jose';
import {createSessionClient,browserAuthorization} from '../src/session-client.mjs';
import {createAuthHandler} from '../src/auth-handler.mjs';
import config from '../aleph.config.json' with {type:'json'};
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;}});
const origin=config.publicAppUrl;

test('auth handler blocks cross-origin mutations and never returns tokens',async()=>{
 let invoked=0;
 const handler=createAuthHandler({clientFactory:()=>({auth:{signInWithPassword:async()=>{invoked++;return {data:{session:{access_token:'fixture-only'}}};},getUser:async()=>({data:{user:{id:'fixture'}}}),signOut:async()=>({})}})});
 const call=async(action,method,headers={},body)=>{const res=response();await handler({query:{action},method,headers,body},res);return res;};
 assert.equal((await call('login','POST',{},{})).code,403);assert.equal(invoked,0);
 assert.equal((await call('logout','POST',{origin:'https://foreign.invalid'})).code,403);
 const headers={origin,'content-type':'application/json'};
 const login=await call('login','POST',headers,{email:['fixture','example.invalid'].join('@'),password:'fictional-fixture'});
 assert.equal(login.code,200);assert.deepEqual(login.body,{authenticated:true});assert.equal(invoked,1);
 assert.deepEqual((await call('session','GET')).body,{authenticated:true});
 assert.deepEqual((await call('logout','POST',{origin})).body,{authenticated:false});
 assert.equal((await call('login','POST',{origin},{})).code,415);
 const denied=await browserAuthorization({method:'DELETE',headers:{cookie:'untrusted=value',origin:'https://foreign.invalid'}},response());
 assert.equal(denied.forbidden,true);
 assert.deepEqual(await browserAuthorization({method:'GET',headers:{authorization:'Bearer invalid',cookie:'untrusted=value'}},response()),{authorization:'Bearer invalid'});
});

test('official SSR SDK persists secure HttpOnly cookies per request and clears them on logout',async()=>{
 const user={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated'};
 const access=await new SignJWT({sub:user.id,role:'authenticated',aud:'authenticated'}).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('1 hour').sign(new Uint8Array(32).fill(7));
 const fetchImpl=async(input)=>{
   const path=new URL(typeof input==='string'?input:input.url).pathname;
   if(path.endsWith('/token'))return Response.json({access_token:access,refresh_token:'fictional-refresh-fixture',token_type:'bearer',expires_in:3600,user});
   if(path.endsWith('/user'))return Response.json(user);
   if(path.endsWith('/logout'))return new Response(null,{status:204});
   throw Error('Unexpected fixture auth route');
 };
 const loginResponse=response();
 const client=createSessionClient({headers:{}},loginResponse,{fetch:fetchImpl});
 const login=await client.auth.signInWithPassword({email:['fixture','example.invalid'].join('@'),password:'fictional-fixture'});
 assert.equal(login.error,null);
 const cookies=loginResponse.headers['Set-Cookie'];assert.ok(cookies.length>0);
 assert.ok(cookies.every(c=>c.includes('HttpOnly')&&c.includes('Secure')&&c.includes('SameSite=Lax')));
 assert.match(loginResponse.headers['Cache-Control'],/no-store/u);
 const cookie=cookies.map(c=>c.split(';')[0]).join('; ');
 const nextResponse=response();
 const next=createSessionClient({headers:{cookie}},nextResponse,{fetch:fetchImpl});
 assert.equal((await next.auth.getUser()).data.user.id,user.id);
 assert.equal((await next.auth.getSession()).data.session.access_token,access);
 assert.equal((await next.auth.signOut({scope:'local'})).error,null);
 assert.ok(nextResponse.headers['Set-Cookie'].some(c=>c.includes('Max-Age=0')));
 assert.equal((await createSessionClient({headers:{}},response(),{fetch:fetchImpl}).auth.getSession()).data.session,null);
});
