import { createClient } from '@supabase/supabase-js';
import { createLoginVerifier } from './verify-login.mjs';
import { createNotesHandler } from './notes-handler.mjs';
import {createRestoreHandler} from './recovery.mjs';
import {createDeviceGate,createDeviceHandler} from './device-approval.mjs';
import config from '../aleph.config.json' with { type:'json' };

let runtime;
let verifier;
let restoreRuntime;
let deviceRuntime;
let deviceGate;
let operationsSnapshot;
export function getIdentityVerifier(){getNotesRuntime();return verifier;}
export function getRestoreRuntime(){getNotesRuntime();return restoreRuntime;}
export function getDevicesRuntime(){getNotesRuntime();return deviceRuntime;}
export function getDeviceGate(){getNotesRuntime();return deviceGate;}
export function getOperationsSnapshot(owner){getNotesRuntime();return operationsSnapshot(owner);}
export function getNotesRuntime() {
  if(runtime) return runtime;
  const url=process.env.SUPABASE_URL;
  const secret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(url!==config.identityProvider.issuer.replace(/\/auth\/v1$/u,'')||!secret) throw Error('DATABASE_NOT_CONFIGURED');
  const client=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const verify=createLoginVerifier({config,supabaseSecretKey:secret,supabaseClient:client});
  verifier=verify;
  const result=async promise=>{const {data,error}=await promise;if(error)throw error;return data;};
  operationsSnapshot=owner=>result(client.rpc('get_operations_snapshot',{p_owner:owner}));
  const devices={
    read:async(owner,hash)=>(await result(client.rpc('get_browser_device_request',{p_owner:owner,p_hash:hash})))?.[0]??null,
    request:async(owner,hash)=>(await result(client.rpc('request_browser_device',{p_owner:owner,p_hash:hash})))?.[0],
  };
  deviceGate=createDeviceGate({store:devices});
  deviceRuntime=createDeviceHandler({verify,store:devices});
  const store={
    list:owner=>result(client.from('notes').select('id,title,body').eq('owner_id',owner).order('created_at',{ascending:false}).limit(100)),
    get:(id,owner)=>result(client.from('notes').select('id,title,body').eq('id',id).eq('owner_id',owner).maybeSingle()),
    create:note=>result(client.rpc('create_note_with_backup',{p_id:note.id,p_owner:note.owner_id,p_title:note.title,p_body:note.body})),
    update:(id,fields,owner)=>result(client.from('notes').update({...fields,owner_id:owner}).eq('id',id).eq('owner_id',owner).select('id,title,body').maybeSingle()),
    remove:async(id,owner)=>Boolean((await result(client.from('notes').delete().eq('id',id).eq('owner_id',owner).select('id')))?.length),
    backup:async(id,owner)=>(await result(client.rpc('get_note_backup',{p_id:id,p_owner:owner})))?.[0]??null,
    restore:async(id,owner,hash)=>(await result(client.rpc('restore_note_backup',{p_id:id,p_owner:owner,p_expected_hash:hash})))?.[0]??null,
  };
  // Every read and mutation is atomically scoped to the verified owner.
  // The service role bypasses RLS, so these API filters remain mandatory.
  runtime=createNotesHandler({verify,store,authorize:deviceGate});
  restoreRuntime=createRestoreHandler({verify,store,authorize:deviceGate});
  return runtime;
}
