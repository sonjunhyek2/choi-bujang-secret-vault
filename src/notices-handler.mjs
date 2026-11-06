const NOTICES=new Map([['welcome',Object.freeze({id:'welcome',title:'학습용 공지',body:'실습 자료만 사용하고 계정 정보를 공유하지 마세요.'})]]);
export function createNoticesHandler({verify}){
  return async function handle(request,response){
    response.setHeader('Cache-Control','private, no-store');
    response.setHeader('X-Content-Type-Options','nosniff');
    const json=(status,body)=>response.status(status).json(body);
    try{
      if(!await verify(request.headers?.authorization))return json(401,{error:'AUTHENTICATION_REQUIRED'});
      if(request.method!=='GET'){response.setHeader('Allow','GET');return json(405,{error:'NOTICE_READ_ONLY'});}
      const id=request.query?.id;
      if(typeof id!=='string'||!NOTICES.has(id))return json(404,{error:'NOTICE_NOT_FOUND'});
      return json(200,NOTICES.get(id));
    }catch{return json(503,{error:'SERVICE_UNAVAILABLE'});}
  };
}
