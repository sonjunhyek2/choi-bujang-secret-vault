import config from '../aleph.config.json' with {type:'json'};
import manifest from '../recovery/safe-policy/manifest.json' with {type:'json'};
import {RULE_IDS} from '../src/decider.mjs';
import {collectAssaultReport,observeRequest} from '../src/assault-report.mjs';
import {browserAuthorization} from '../src/session-client.mjs';
import {getIdentityVerifier,getDeviceGate,getOperationsSnapshot} from '../src/notes-runtime.mjs';
import {traceResponse} from '../src/request-trace.mjs';
let cachedPublicReport;
let cachedUntil=0;
export default async function handler(request,response){
  traceResponse(response);
  response.setHeader('Cache-Control','private, no-store');response.setHeader('Vary','Cookie, Origin');
  if(request.method!=='GET')return response.status(405).json({error:'METHOD_NOT_ALLOWED'});
  try{
    if(!cachedPublicReport||Date.now()>cachedUntil){cachedPublicReport=collectAssaultReport(config);cachedUntil=Date.now()+30000;}
    const report=structuredClone(await cachedPublicReport);
    const auth=await browserAuthorization(request,response);
    const principal=auth.authorization?await getIdentityVerifier()(auth.authorization):null;
    const approved=principal&&await getDeviceGate()(request,principal);
    let serverRecords={state:principal?'approval_required':'not_authenticated'};
    const normal={id:'N03',name:'로그인·승인 후 본인 자료 정상 조회',request:'GET /api/notes',expected:'200, 본인 배열',status:'not_run',checkedAt:null,requestId:null,httpStatus:null};
    if(approved){
      try{serverRecords={state:'available',...await getOperationsSnapshot(principal.userId)};}catch{serverRecords={state:'unavailable'};}
      Object.assign(normal,await observeRequest({url:new URL('/api/notes',config.publicAppUrl).href,headers:{Authorization:auth.authorization,...(request.headers.cookie?{Cookie:request.headers.cookie}:{})},statuses:[200],validate:text=>{try{return Array.isArray(JSON.parse(text));}catch{return false;}}}));
    }
    report.normalChecks.push(normal);
    return response.status(200).json({
      rules:RULE_IDS,report,serverRecords,
      detection:{state:'not_connected',rule:'burst_read',windowSeconds:600,threshold:121,events:null},
      revocation:{state:'not_connected',result:null},
      recovery:{sourceCommit:manifest.sourceCommit,integrity:'pinned_manifest_and_file_hashes',lastRecovery:serverRecords.lastRecovery??null},
      sources:{engine:'ALEPH SDP 엔진 사용. 실제 엔진 사건·회수 연동은 미검증.',student:'이 저장소의 판정·탐지·접속 화면·소유자 API·복구·자체 점검',officialResult:'ALEPH /defense의 단계별 판정 기록에서 별도 확인'},
    });
  }catch{return response.status(503).json({error:'OPERATIONS_UNAVAILABLE'});}
}
