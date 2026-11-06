import {createHash} from 'node:crypto';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
export const RECOVERY_TEST_NOTE_ID='b2222222-2222-4222-8222-222222222222';
export function noteDigest(note){
  const framed=`${note.id.toLowerCase()}|${note.owner_id.toLowerCase()}|${Buffer.byteLength(note.title)}:${note.title}${Buffer.byteLength(note.body)}:${note.body}`;
  return createHash('sha256').update(framed,'utf8').digest('hex');
}
export function createRestoreHandler({verify,store,authorize=async()=>true}){
  return async function handle(request,response){
    response.setHeader('Cache-Control','private, no-store');
    response.setHeader('X-Content-Type-Options','nosniff');
    const json=(status,body)=>response.status(status).json(body);
    try{
      const principal=await verify(request.headers?.authorization);
      if(!principal)return json(401,{error:'AUTHENTICATION_REQUIRED'});
      if(!await authorize(request,principal))return json(403,{error:'DEVICE_APPROVAL_REQUIRED'});
      if(principal.kind==='judge'&&principal.identity!=='b')return json(403,{error:'TEST_B_ONLY'});
      if(!['GET','POST'].includes(request.method))return json(405,{error:'METHOD_NOT_ALLOWED'});
      let body=request.body;
      if(typeof body==='string'){try{body=JSON.parse(body);}catch{return json(400,{error:'INVALID_JSON'});}}
      const raw=request.query?.id??body?.id??RECOVERY_TEST_NOTE_ID;
      if(typeof raw!=='string'||!UUID.test(raw))return json(400,{error:'INVALID_NOTE_ID'});
      const id=raw.toLowerCase();
      const snapshot=await store.backup(id,principal.userId);
      if(!snapshot)return json(404,{error:'BACKUP_NOT_FOUND'});
      if(snapshot.id!==id||snapshot.owner_id!==principal.userId.toLowerCase()||noteDigest(snapshot)!==snapshot.content_hash)return json(409,{error:'BACKUP_INTEGRITY_FAILED'});
      if(request.method==='GET')return json(200,{id,owner_id:snapshot.owner_id,content_hash:snapshot.content_hash,version:snapshot.created_at});
      const restored=await store.restore(id,principal.userId,snapshot.content_hash);
      if(!restored)return json(404,{error:'BACKUP_NOT_FOUND'});
      return json(200,{id:restored.id,content_hash:snapshot.content_hash,restored:true});
    }catch(error){
      if(error?.code==='22000')return json(409,{error:'BACKUP_INTEGRITY_FAILED'});
      if(error?.code==='42501')return json(403,{error:'RESTORE_FORBIDDEN'});
      return json(503,{error:'RESTORE_UNAVAILABLE'});
    }
  };
}
