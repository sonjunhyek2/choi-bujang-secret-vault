import assert from 'node:assert/strict';
import { test } from 'node:test';
import handler from '../api/notes.js';

function response() {
  return { headers:{}, code:null, body:null, setHeader(k,v){this.headers[k]=v;}, status(code){this.code=code;return this;}, json(body){this.body=body;} };
}

test('notes API closes on missing configuration and unsupported methods', async () => {
  const saved={url:process.env.SUPABASE_URL,secret:process.env.SUPABASE_SECRET_KEY,legacy:process.env.SUPABASE_SERVICE_ROLE_KEY};
  try {
    delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SECRET_KEY; delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const missing=response(); await handler({method:'GET'},missing);
    assert.equal(missing.code,503); assert.deepEqual(missing.body,{error:'DATABASE_NOT_CONFIGURED'});
    const post=response(); await handler({method:'POST'},post);
    assert.equal(post.code,405); assert.equal(post.headers.Allow,'GET');
  } finally {
    for(const [key,value] of Object.entries({SUPABASE_URL:saved.url,SUPABASE_SECRET_KEY:saved.secret,SUPABASE_SERVICE_ROLE_KEY:saved.legacy})) {
      if(value===undefined)delete process.env[key];else process.env[key]=value;
    }
  }
});

test('notes API limits and projects upstream data without leaking secrets or errors', async () => {
  const savedFetch=globalThis.fetch, savedUrl=process.env.SUPABASE_URL,savedSecret=process.env.SUPABASE_SECRET_KEY;
  try {
    process.env.SUPABASE_URL='https://abcdefghijklmnopqrst.supabase.co';
    process.env.SUPABASE_SECRET_KEY='test-server-key';
    globalThis.fetch=async(url,options)=>{
      assert.equal(url.searchParams.get('select'),'title,content');
      assert.equal(options.redirect,'error');
      return new Response(JSON.stringify([{title:'fixture',content:'test',internal:'omit'}]),{status:200});
    };
    const success=response();await handler({method:'GET'},success);
    assert.equal(success.code,200);assert.deepEqual(success.body,{notes:[{title:'fixture',content:'test'}]});
    assert.equal(success.headers['Cache-Control'],'no-store');
    globalThis.fetch=async()=>new Response(JSON.stringify({error:'upstream secret test-server-key'}),{status:401});
    const failure=response();await handler({method:'GET'},failure);
    assert.equal(failure.code,502);assert.deepEqual(failure.body,{error:'DATABASE_UNAVAILABLE'});
    globalThis.fetch=async()=>new Response(JSON.stringify([{title:42,content:'test'}]),{status:200});
    const malformed=response();await handler({method:'GET'},malformed);assert.equal(malformed.code,502);
  } finally {
    globalThis.fetch=savedFetch;
    if(savedUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=savedUrl;
    if(savedSecret===undefined)delete process.env.SUPABASE_SECRET_KEY;else process.env.SUPABASE_SECRET_KEY=savedSecret;
  }
});
