import { getNotesRuntime } from '../src/notes-runtime.mjs';
export default async function handler(request,response) {
  try { return await getNotesRuntime()(request,response); }
  catch {
    response.setHeader('Cache-Control','no-store');
    response.status(503).json({error:'SERVICE_UNAVAILABLE'});
  }
}
