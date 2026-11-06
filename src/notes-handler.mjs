import { randomUUID } from 'node:crypto';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export function createNotesHandler({verify,store}) {
  return async function handle(request,response) {
    response.setHeader('Cache-Control','no-store');
    response.setHeader('X-Content-Type-Options','nosniff');
    const json=(status,body)=>response.status(status).json(body);
    try {
      const principal=await verify(request.headers?.authorization);
      if(!principal) return json(401,{error:'AUTHENTICATION_REQUIRED'});
      const rawId=request.query?.id;
      if(rawId!==undefined&&(typeof rawId!=='string'||!UUID.test(rawId))) return json(400,{error:'INVALID_NOTE_ID'});
      const id=rawId?.toLowerCase();
      if(request.method==='GET') {
        if(!id) return json(200,await store.list(principal.userId));
        const note=await store.get(id,principal.userId);
        return note?json(200,note):json(404,{error:'NOTE_NOT_FOUND'});
      }
      if(request.method==='DELETE'&&id) {
        const removed=await store.remove(id,principal.userId);
        return removed?json(200,{id}):json(404,{error:'NOTE_NOT_FOUND'});
      }
      if(request.method==='POST'&&!id||request.method==='PUT'&&id) {
        let body=request.body;
        if(typeof body==='string') {try{body=JSON.parse(body);}catch{return json(400,{error:'INVALID_JSON'});}}
        if(!body||typeof body!=='object'||Array.isArray(body)||typeof body.title!=='string'||
          !body.title.trim()||body.title.length>200||typeof body.body!=='string'||body.body.length>10000) return json(400,{error:'INVALID_NOTE'});
        if(body.owner_id!==undefined&&body.owner_id!==principal.userId) return json(403,{error:'OWNER_CHANGE_FORBIDDEN'});
        const fields={title:body.title.trim(),body:body.body};
        if(request.method==='POST') {
          if(body.id!==undefined&&(typeof body.id!=='string'||!UUID.test(body.id))) return json(400,{error:'INVALID_NOTE_ID'});
          const createdId=body.id?.toLowerCase()||randomUUID();
          await store.create({id:createdId,...fields,owner_id:principal.userId});
          return json(201,{id:createdId});
        }
        const updated=await store.update(id,fields,principal.userId);
        return updated?json(200,updated):json(404,{error:'NOTE_NOT_FOUND'});
      }
      response.setHeader('Allow',id?'GET, PUT, DELETE':'GET, POST');
      return json(405,{error:'METHOD_NOT_ALLOWED'});
    } catch(error) {
      if(error?.code==='23505') return json(409,{error:'NOTE_ID_EXISTS'});
      return json(503,{error:'SERVICE_UNAVAILABLE'});
    }
  };
}
