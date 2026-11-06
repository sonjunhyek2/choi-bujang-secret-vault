import {browserAuthorization} from '../src/session-client.mjs';
import {getRestoreRuntime} from '../src/notes-runtime.mjs';
export default async function handler(request,response){
  response.setHeader('Cache-Control','private, no-store');
  response.setHeader('Vary','Cookie, Origin');
  try{
    const auth=await browserAuthorization(request,response);
    if(auth.forbidden)return response.status(403).json({error:'ORIGIN_NOT_ALLOWED'});
    return await getRestoreRuntime()({...request,headers:{...request.headers,authorization:auth.authorization}},response);
  }catch{return response.status(503).json({error:'RESTORE_UNAVAILABLE'});}
}
