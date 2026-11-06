const el=id=>document.getElementById(id);
let latest,sequence=0;
const labels={not_run:'미실행',observed_pass:'기대 응답 확인',observed_fail:'기대와 다름',observed_error:'응답 확인 실패'};
function show(data){
  latest=data;const report=data.report;
  el('ops-executed').textContent=`${report.summary.executed} / ${report.summary.total}`;
  el('ops-not-run').textContent=`${report.summary.notRun} / ${report.summary.total}`;
  el('ops-failed').textContent=String([...report.checks,...report.normalChecks].filter(c=>['observed_fail','observed_error'].includes(c.status)).length);
  el('ops-rules').replaceChildren(...data.rules.map(rule=>{const span=document.createElement('span');span.className='pill';span.textContent=rule;return span;}));
  el('ops-version').textContent=report.deployment?`실측 커밋 ${report.deployment.commit} · ${report.deployment.step}단계 · 결과 작성 ${report.createdAt}`:'점검 전후 배포 커밋을 같은 것으로 확인하지 못했습니다.';
  el('ops-detection').textContent=`${data.detection.rule} · 10분에 121건 이상 · 실제 운영 사건 미연결`;
  el('ops-revocation').textContent='운영 엔진 연결 안 됨 · 실제 신원·세션 회수 결과 미확인';
  el('ops-recovery').textContent=`정책 사본 ${data.recovery.sourceCommit}`;
  const record=data.serverRecords;
  el('ops-records').textContent=record.state==='available'?`본인 서버 기록: 사본 ${record.backupCount}건 · 복원 ${record.recoveryCount}건. ${record.lastRecovery?`마지막 복원 ${record.lastRecovery.at} · 해시 ${record.lastRecovery.contentHash}`:'실제 복원 기록 없음'}`:record.state==='unavailable'?'서버 기록을 읽지 못했습니다. 결과는 미확인입니다.':'로그인·기기 승인 뒤 본인 서버 기록만 확인할 수 있습니다.';
  el('ops-plan').textContent=report.planNotice;
  const rows=[...report.normalChecks,...report.checks].map(check=>{
    const row=document.createElement('tr');
    const values=[check.id,check.name,check.request,check.expected,`${labels[check.status]||'미확인'}${check.httpStatus!==null?` · HTTP ${check.httpStatus}`:''}`,check.requestId||'확인 안 됨',check.checkedAt||'미실행'];
    values.forEach((value,index)=>{const cell=document.createElement(index===0?'th':'td');if(index===0)cell.scope='row';cell.textContent=value;if(index===4)cell.className=check.status==='observed_pass'?'pass':check.status==='not_run'?'warn':'fail';row.append(cell);});return row;
  });
  el('ops-results').replaceChildren(...rows);
  el('ops-sources').textContent=`제공: ${data.sources.engine} 학생 작업: ${data.sources.student}. 공식 판정: ${data.sources.officialResult}.`;
  el('ops-export').disabled=false;
}
async function load(){
  const seq=++sequence;el('ops-refresh').disabled=true;el('load-state').textContent='현재 배포에 요청을 보내 확인하고 있습니다.';
  try{const response=await fetch('/api/operations',{credentials:'same-origin',cache:'no-store'});const data=await response.json();if(seq!==sequence)return;if(!response.ok)throw Error('작전실 결과를 읽지 못했습니다.');show(data);el('load-state').textContent='실제 응답을 반영했습니다. 미실행 항목은 아래 표에 그대로 남아 있습니다.';}
  catch(error){if(seq===sequence){latest=null;el('ops-export').disabled=true;el('load-state').textContent=error.message;}}
  finally{if(seq===sequence)el('ops-refresh').disabled=false;}
}
el('ops-refresh').addEventListener('click',load);
el('ops-export').addEventListener('click',()=>{if(!latest)return;const url=URL.createObjectURL(new Blob([JSON.stringify(latest,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='aleph-self-check.json';a.click();URL.revokeObjectURL(url);});
load();
