import plan from '../docs/ASSAULT_PLAN.json' with {type:'json'};
const KEY=/sb_publishable_|sb_secret_|-----BEGIN [A-Z ]*PRIVATE KEY-----/u;
const probes=[
  {id:'T01',path:'/data.json',statuses:[404]},
  {id:'T02',path:'/',statuses:[200],validate:(text,config)=>!text.includes(config.sampleMarker)},
  {id:'T03',original:true,statuses:[401,403]},
  {id:'T05',path:'/app.js',statuses:[200],validate:text=>!KEY.test(text)},
  {id:'T06',path:'/api/notes',statuses:[401,403]},
  {id:'T08',path:'/api/notes',statuses:[401,403],headers:{Authorization:'Bearer invalid'}},
  {id:'N01',name:'배포 식별 정보 정상 조회',path:'/aleph.json',statuses:[200],validate:text=>{try{return /^[a-f0-9]{40}$/u.test(JSON.parse(text).commit||'');}catch{return false;}}},
  {id:'N02',name:'비로그인 상태 정상 확인',path:'/api/auth/session',statuses:[200],validate:text=>{try{return JSON.parse(text).authenticated===false;}catch{return false;}}},
];
export async function observeRequest({url,headers={},statuses,validate,config,fetchImpl=fetch}){
  const checkedAt=new Date().toISOString();
  try{
    const response=await fetchImpl(url,{method:'GET',headers,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});
    const text=await response.text();
    const ok=statuses.includes(response.status)&&(!validate||validate(text,config));
    return {status:ok?'observed_pass':'observed_fail',httpStatus:response.status,requestId:response.headers.get('x-request-id')||response.headers.get('x-vercel-id')||null,checkedAt};
  }catch{return {status:'observed_error',httpStatus:null,requestId:null,checkedAt,error:'REQUEST_NOT_COMPLETED'};}
}
export async function collectAssaultReport(config,{fetchImpl=fetch}={}){
  async function readDeployment(){
    try{const response=await fetchImpl(new URL('/aleph.json',config.publicAppUrl),{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});const data=await response.json();if(response.ok&&/^[a-f0-9]{40}$/u.test(data.commit||'')&&data.repoUrl===config.repoUrl)return {commit:data.commit,step:data.step};}catch{}
    return null;
  }
  const before=await readDeployment();
  const checks=plan.checks.map(check=>({...check,status:'not_run',httpStatus:null,requestId:null,checkedAt:null,reason:'별도 계정·승인 또는 운영 엔진이 필요한 시험입니다.'}));
  const normalChecks=[];
  const results=await Promise.allSettled(probes.map(async probe=>{
    const url=probe.original?config.originalApiUrl:new URL(probe.path,config.publicAppUrl).href;
    const headers=probe.original?{apikey:'sb_publishable_4-Lyfr2q9QQnZ4DkgCF7Bw_RRqfJMCw'}:probe.headers;
    return {probe,observed:await observeRequest({...probe,url,headers,config,fetchImpl})};
  }));
  for(const result of results){
    if(result.status!=='fulfilled')continue;
    const {probe,observed}=result.value;
    if(probe.id.startsWith('N'))normalChecks.push({id:probe.id,name:probe.name,request:`GET ${probe.path}`,expected:'200',...observed});
    else Object.assign(checks.find(c=>c.id===probe.id),observed,{reason:undefined});
  }
  const after=await readDeployment();
  const deployment=before&&after&&before.commit===after.commit?after:null;
  return {schema:'aleph.assault.report.v1',source:'실제 현재 배포에 보낸 자체 HTTP 점검. 공식 심판 판정과 별개입니다.',planNotice:plan.notice,createdAt:new Date().toISOString(),deployment,checks,normalChecks,summary:{total:checks.length,executed:checks.filter(c=>c.status!=='not_run').length,passed:checks.filter(c=>c.status==='observed_pass').length,notRun:checks.filter(c=>c.status==='not_run').length}};
}
