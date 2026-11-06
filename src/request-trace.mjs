import {randomUUID} from 'node:crypto';
export function traceResponse(response){
  const id=randomUUID();response.setHeader('X-Request-ID',id);return id;
}
