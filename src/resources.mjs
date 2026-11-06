// Explicit relay resource IDs. /api is stripped by some engine adapters.
export const RESOURCES=Object.freeze({notes:'personal_note',notices:'class_notice',teacher:'teacher_material'});
const METHODS=Object.freeze({notes:['GET','PUT','DELETE'],notices:['GET']});
const RESERVED=new Set(['export','import','search','batch','list','.','..']);
export function allowedResource(request) {
  if(request?.queryLength!==0||!Object.hasOwn(METHODS,request?.service||''))return false;
  if(!METHODS[request.service].includes(request.method)||typeof request.path!=='string')return false;
  const match=/^\/(api\/)?(notes|notices)\/([A-Za-z0-9_-]+)$/u.exec(request.path);
  if(!match||match[2]!==request.service||RESERVED.has(match[3].toLowerCase()))return false;
  return request.route===`${request.method} /${match[1]||''}${match[2]}/:id`;
}
