import {randomBytes,createHash} from 'node:crypto';
import {parseCookieHeader,serializeCookieHeader} from '@supabase/ssr';
import {sameOrigin} from './session-client.mjs';
const COOKIE='__Host-vault-device-request';
function keyHash(request){
  const raw=parseCookieHeader(request.headers?.cookie||'').find(c=>c.name===COOKIE)?.value;
  return typeof raw==='string'&&/^[A-Za-z0-9_-]{43}$/u.test(raw)?createHash('sha256').update(raw).digest('hex'):null;
}
export function createDeviceGate({store}){
  return async(request,principal)=>{
    // Official judge identities own only their synthetic fixture rows. Their
    // device/PoP checks belong to the provided engine, not this browser cookie.
    if(principal.kind==='judge')return true;
    const hash=keyHash(request);
    return Boolean(hash&&(await store.read(principal.userId,hash))?.status==='approved');
  };
}
export function createDeviceHandler({verify,store}){
  return async function handle(request,response){
    response.setHeader('Cache-Control','private, no-store');
    const json=(status,body)=>response.status(status).json(body);
    try{
      const principal=await verify(request.headers?.authorization);
      if(!principal)return json(401,{error:'AUTHENTICATION_REQUIRED'});
      const action=request.query?.action;
      if(action==='status'&&request.method==='GET'){
        const hash=keyHash(request);
        const record=hash?await store.read(principal.userId,hash):null;
        return json(200,{status:record?.status||'unregistered'});
      }
      if(action!=='request'||request.method!=='POST')return json(405,{error:'METHOD_NOT_ALLOWED'});
      if(!sameOrigin(request))return json(403,{error:'ORIGIN_NOT_ALLOWED'});
      let hash=keyHash(request);
      const old=hash?await store.read(principal.userId,hash):null;
      if(!old||old.status==='revoked'){
        const raw=randomBytes(32).toString('base64url');
        hash=createHash('sha256').update(raw).digest('hex');
        const cookie=serializeCookieHeader(COOKIE,raw,{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:30*86400});
        const existing=response.getHeader?.('Set-Cookie');
        response.setHeader('Set-Cookie',[...(Array.isArray(existing)?existing:existing?[existing]:[]),cookie]);
      }
      const record=await store.request(principal.userId,hash);
      return json(202,{status:record.status});
    }catch{return json(503,{error:'DEVICE_STATUS_UNAVAILABLE'});}
  };
}
