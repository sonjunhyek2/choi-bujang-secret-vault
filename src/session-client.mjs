import {createServerClient,parseCookieHeader,serializeCookieHeader} from '@supabase/ssr';
import config from '../aleph.config.json' with {type:'json'};

// This module is server-only. The browser bundle imports no Supabase client or key.
const url=config.identityProvider.issuer.replace(/\/auth\/v1$/u,'');
const publishable='sb_publishable_4-Lyfr2q9QQnZ4DkgCF7Bw_RRqfJMCw';
export function sameOrigin(request,env=process.env) {
  const origins=new Set([new URL(config.publicAppUrl).origin]);
  if(/^[a-z0-9-]+\.vercel\.app$/u.test(env.VERCEL_URL||'')) origins.add(`https://${env.VERCEL_URL}`);
  return typeof request.headers?.origin==='string'&&origins.has(request.headers.origin);
}
export function createSessionClient(request,response,{fetch:fetchImpl}={}) {
  const current=new Map(parseCookieHeader(request.headers?.cookie||'').map(c=>[c.name,c.value]));
  const written=new Map();
  return createServerClient(url,publishable,{
    ...(fetchImpl?{global:{fetch:fetchImpl}}:{}),
    cookieOptions:{httpOnly:true,secure:true,sameSite:'lax',path:'/'},
    cookies:{
      getAll:()=>[...current].map(([name,value])=>({name,value})),
      setAll(cookies,headers){
        for(const {name,value,options} of cookies){
          current.set(name,value);
          written.set(name,serializeCookieHeader(name,value,{...options,httpOnly:true,secure:true,sameSite:'lax',path:'/'}));
        }
        response.setHeader('Set-Cookie',[...written.values()]);
        for(const [name,value] of Object.entries(headers||{}))response.setHeader(name,value);
        response.setHeader('Cache-Control','private, no-store');
      },
    },
  });
}

export async function browserAuthorization(request,response) {
  if(request.headers?.authorization!==undefined)return {authorization:request.headers.authorization};
  if(!request.headers?.cookie)return {};
  if(!['GET','HEAD'].includes(request.method)&&!sameOrigin(request))return {forbidden:true};
  // getSession only transports the SDK-managed token; the unchanged provided
  // verifier still validates its signature, issuer, audience and expiry next.
  const {data,error}=await createSessionClient(request,response).auth.getSession();
  if(error||!data.session?.access_token)return {};
  return {authorization:`Bearer ${data.session.access_token}`};
}
