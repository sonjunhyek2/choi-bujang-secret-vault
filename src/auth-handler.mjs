import {createSessionClient,sameOrigin} from './session-client.mjs';

export function createAuthHandler({clientFactory=createSessionClient}={}) {
  return async function handle(request,response) {
    response.setHeader('Cache-Control','private, no-store');
    response.setHeader('Vary','Cookie, Origin');
    response.setHeader('X-Content-Type-Options','nosniff');
    const json=(status,body)=>response.status(status).json(body);
    const action=request.query?.action;
    if(!['session','login','logout'].includes(action))return json(404,{error:'NOT_FOUND'});
    if(request.method!==(action==='session'?'GET':'POST'))return json(405,{error:'METHOD_NOT_ALLOWED'});
    if(action!=='session'&&!sameOrigin(request))return json(403,{error:'ORIGIN_NOT_ALLOWED'});
    try {
      if(action==='login') {
        if(!request.headers?.['content-type']?.startsWith('application/json'))return json(415,{error:'JSON_REQUIRED'});
        let body=request.body;
        if(typeof body==='string'){try{body=JSON.parse(body);}catch{return json(400,{error:'INVALID_JSON'});}}
        if(typeof body?.email!=='string'||body.email.length>254||!body.email.includes('@')||typeof body.password!=='string'||!body.password||body.password.length>4096)return json(400,{error:'INVALID_LOGIN'});
        const {data,error}=await clientFactory(request,response).auth.signInWithPassword({email:body.email.trim(),password:body.password});
        if(error||!data?.session)return json(401,{error:'LOGIN_FAILED'});
        return json(200,{authenticated:true});
      }
      const client=clientFactory(request,response);
      if(action==='logout'){
        const {error}=await client.auth.signOut({scope:'local'});
        return error?json(503,{error:'LOGOUT_FAILED'}):json(200,{authenticated:false});
      }
      // Revalidate at Auth; never trust cookie user metadata or a decoded JWT.
      const {data,error}=await client.auth.getUser();
      return json(200,{authenticated:!error&&Boolean(data?.user)});
    }catch{return json(503,{error:'AUTH_SERVICE_UNAVAILABLE'});}
  };
}
