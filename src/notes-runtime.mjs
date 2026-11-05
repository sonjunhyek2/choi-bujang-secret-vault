import { createClient } from '@supabase/supabase-js';
import { createLoginVerifier } from './verify-login.mjs';
import { createNotesHandler } from './notes-handler.mjs';
import config from '../aleph.config.json' with { type:'json' };

let runtime;
export function getNotesRuntime() {
  if(runtime) return runtime;
  const url=process.env.SUPABASE_URL;
  const secret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(url!==config.identityProvider.issuer.replace(/\/auth\/v1$/u,'')||!secret) throw Error('DATABASE_NOT_CONFIGURED');
  const client=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const verify=createLoginVerifier({config,supabaseSecretKey:secret,supabaseClient:client});
  const result=async promise=>{const {data,error}=await promise;if(error)throw error;return data;};
  const store={
    list:owner=>result(client.from('notes').select('id,title,body').eq('owner_id',owner).order('created_at',{ascending:false}).limit(100)),
    get:id=>result(client.from('notes').select('id,title,body').eq('id',id).maybeSingle()),
    create:note=>result(client.from('notes').insert(note)),
    update:(id,fields)=>result(client.from('notes').update(fields).eq('id',id).select('id,title,body').maybeSingle()),
    remove:async id=>Boolean((await result(client.from('notes').delete().eq('id',id).select('id')))?.length),
  };
  // Stage 3 leaves single-object ownership enforcement to stage 4.
  // Every request verifies identity; client-supplied owner_id or role is ignored.
  runtime=createNotesHandler({verify,store});
  return runtime;
}
