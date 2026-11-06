import { getNotesRuntime } from '../src/notes-runtime.mjs';
import {browserAuthorization} from '../src/session-client.mjs';
import {traceResponse} from '../src/request-trace.mjs';
export default async function handler(request,response) {
  traceResponse(response);
  response.setHeader('Cache-Control','private, no-store');
  response.setHeader('Vary','Cookie, Origin');
  try {
    const auth=await browserAuthorization(request,response);
    if(auth.forbidden)return response.status(403).json({error:'ORIGIN_NOT_ALLOWED'});
    return await getNotesRuntime()({...request,headers:{...request.headers,authorization:auth.authorization}},response);
  }
  catch {
    response.setHeader('Cache-Control','no-store');
    response.status(503).json({error:'SERVICE_UNAVAILABLE'});
  }
}
