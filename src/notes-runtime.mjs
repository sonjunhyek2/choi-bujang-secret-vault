import { createClient } from '@supabase/supabase-js';
import { createLoginVerifier } from './verify-login.mjs';
import { createNotesHandler } from './notes-handler.mjs';
import config from '../aleph.config.json' with { type:'json' };

let runtime;
let verifier;
export function getIdentityVerifier(){getNotesRuntime();return verifier;}
export function getNotesRuntime() {
  if(runtime) return runtime;
  const url=process.env.SUPABASE_URL;
  const secret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(url!==config.identityProvider.issuer.replace(/\/auth\/v1$/u,'')||!secret) throw Error('DATABASE_NOT_CONFIGURED');
  const client=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const verify=createLoginVerifier({config,supabaseSecretKey:secret,supabaseClient:client});
  verifier=verify;
  const result=async promise=>{const {data,error}=await promise;if(error)throw error;return data;};
  const store={
    list:owner=>result(client.from('notes').select('id,title,body').eq('owner_id',owner).order('created_at',{ascending:false}).limit(100)),
    get:(id,owner)=>result(client.from('notes').select('id,title,body').eq('id',id).eq('owner_id',owner).maybeSingle()),
    create:note=>result(client.from('notes').insert(note)),
    update:(id,fields,owner)=>result(client.from('notes').update({...fields,owner_id:owner}).eq('id',id).eq('owner_id',owner).select('id,title,body').maybeSingle()),
    remove:async(id,owner)=>Boolean((await result(client.from('notes').delete().eq('id',id).eq('owner_id',owner).select('id')))?.length),
  };
  // Every read and mutation is atomically scoped to the verified owner.
  // The service role bypasses RLS, so these API filters remain mandatory.
  runtime=createNotesHandler({verify,store});
  return runtime;
}
