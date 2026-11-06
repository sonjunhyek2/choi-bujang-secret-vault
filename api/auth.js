import {createAuthHandler} from '../src/auth-handler.mjs';
import {traceResponse} from '../src/request-trace.mjs';
const auth=createAuthHandler();
export default function handler(request,response){traceResponse(response);return auth(request,response);}
