// The student changes this check as each stage adds an attack to the same app.
// Never return tokens, private keys, real names, or note bodies.
export async function runAttackChecks(config) {
  if ([3,4].includes(config.step)) return runStageThreeChecks(config);
  if (config.step === 2) return runStageTwoChecks(config);
  if (config.step !== 1) throw new Error('이 단계의 공격 점검을 src/attack-check.mjs에 구현해 주세요.');
  let app;
  try {
    app = new URL(config.publicAppUrl);
  } catch {
    throw new Error('aleph.config.json의 실제 배포 주소를 먼저 넣어 주세요.');
  }
  if (app.protocol !== 'https:' || app.username || app.password || app.search || app.hash
      || app.pathname !== '/' || app.hostname.endsWith('.example')) {
    throw new Error('aleph.config.json의 실제 배포 주소를 먼저 넣어 주세요.');
  }
  if (typeof config.sampleMarker !== 'string' || !config.sampleMarker) throw new Error('가상 메모의 확인 표시를 넣어 주세요.');
  const response = await fetch(new URL('/data.json', app), {
    redirect: 'error', signal: AbortSignal.timeout(10000),
  });
  let visible = false;
  if (response.ok) {
    try {
      const data = await response.json();
      visible = data?.sampleMarker === config.sampleMarker && Array.isArray(data.notes)
        && data.notes.length > 0;
    } catch {
      // A non-JSON response is a failed check, not a successful deployment.
    }
  }
  return [{ attackId: 'anonymous_note_read', expected: '비로그인 화면에서 가상 메모를 확인',
    observed: visible ? '비로그인 요청에서 공개 가상 메모 확인 표시가 보임' : `비로그인 요청에서 확인 표시가 보이지 않음 (HTTP ${response.status})` }];
}

async function runStageThreeChecks(config) {
  const app=new URL(config.publicAppUrl);
  if(app.protocol!=='https:'||app.username||app.password||app.search||app.hash||app.pathname!=='/'||app.hostname.endsWith('.example')) throw new Error('실제 배포 주소를 먼저 설정하세요.');
  const attempts=[];
  for(const [attackId,method,headers,body] of [
    ['anonymous_note_read','GET',{},undefined],
    ['anonymous_note_create','POST',{'Content-Type':'application/json'},JSON.stringify({title:'self-check',body:'fictional request without authentication'})],
    ['invalid_token_read','GET',{Authorization:'Bearer invalid'},undefined],
  ]) {
    const response=await fetch(new URL('/api/notes',app),{method,headers,body,redirect:'error',signal:AbortSignal.timeout(10000)});
    let errorJson=false;
    try {const data=await response.json();errorJson=typeof data.error==='string';}catch{/* HTML is not an authentication rejection. */}
    attempts.push({attackId,expected:'인증 없는 또는 유효하지 않은 요청은 자료 없이 401/403 JSON 오류로 거부',observed:`HTTP ${response.status}, JSON 오류 ${errorJson?'확인됨':'확인되지 않음'}, 거부 ${[401,403].includes(response.status)?'확인됨':'확인되지 않음'}`});
  }
  const identityResponse=await fetch(new URL('/aleph.json',app),{redirect:'error',signal:AbortSignal.timeout(10000)});
  let identityMatches=false;
  if(identityResponse.ok){try{const id=await identityResponse.json();identityMatches=id.step===config.step&&id.repoUrl===config.repoUrl&&/^[a-f0-9]{40}$/u.test(id.commit||'');}catch{}}
  attempts.push({attackId:'deployment_identity',expected:`${config.step}단계 배포 식별 정보`,observed:identityMatches?'확인됨':'확인되지 않음'});
  if(config.step===4) attempts.push({attackId:'cross_owner_crud',expected:'실제 A/B 각자 CRUD 허용, 상대 자료 조회·수정·삭제 거부',observed:'실제 A/B 로그인 요청은 이 자기 점검에서 미실행. 로컬 모의 시험과 DB 역할 시험은 별도이며 공식 판정으로 대체하지 않습니다.'});
  attempts.push({attackId:'student_login_crud',expected:'실제 A 계정의 이메일·비밀번호 로그인과 CRUD',observed:'이 자기 점검에서는 미실행. 로컬 모의 토큰 시험과 공식 심판의 정상 요청 검증을 별도 기록합니다.'});
  return attempts;
}

async function runStageTwoChecks(config) {
  const app = new URL(config.publicAppUrl);
  if (app.protocol !== 'https:' || app.username || app.password || app.search || app.hash ||
      app.pathname !== '/' || app.hostname.endsWith('.example')) throw new Error('실제 배포 주소를 먼저 설정하세요.');
  const get = path => fetch(new URL(path, app), { redirect: 'error', signal: AbortSignal.timeout(10000), cache: 'no-store' });
  const staticResponse = await get('/data.json');
  let staticRemoved = staticResponse.status === 404;
  if (staticResponse.ok) {
    try { const data = await staticResponse.json(); staticRemoved = Array.isArray(data.notes) && data.notes.length === 0; } catch { /* HTML is not proof of removal. */ }
  }
  const page = await get('/');
  const pageHtml = page.ok ? await page.text() : '';
  const pageWorking = page.ok && pageHtml.includes('/api/notes');
  const headersPresent = page.headers.get('x-content-type-options')?.toLowerCase() === 'nosniff' || Boolean(page.headers.get('content-security-policy'));
  const api = await get('/api/notes');
  let apiWorking = false;
  if (api.ok) {
    try { const result = await api.json(); apiWorking = Array.isArray(result.notes) && result.notes.every(note => typeof note.title === 'string' && typeof note.content === 'string'); } catch { /* Invalid JSON is a failed check. */ }
  }
  const identityResponse = await get('/aleph.json');
  let identityMatches = false;
  if (identityResponse.ok) {
    try { const identity = await identityResponse.json(); identityMatches = identity.step === 2 && identity.repoUrl === config.repoUrl && /^[a-f0-9]{40}$/u.test(identity.commit || ''); } catch { /* Not a deployment identity. */ }
  }
  return [
    { attackId: 'static_note_read', expected: '공개 data.json은 404 또는 메모 0건', observed: `${staticRemoved ? '확인됨' : '확인되지 않음'} (HTTP ${staticResponse.status})` },
    { attackId: 'server_note_read', expected: '가상 자료실 화면과 서버 API가 동작', observed: `화면 ${pageWorking ? '확인됨' : '확인되지 않음'}, API ${apiWorking ? '확인됨' : '확인되지 않음'} (HTTP ${api.status})` },
    { attackId: 'deployment_identity', expected: '2단계 저장소·커밋 식별 정보 응답', observed: identityMatches ? '배포 식별 정보 확인됨' : '배포 식별 정보 확인되지 않음' },
    { attackId: 'security_headers', expected: 'nosniff 또는 CSP 응답 헤더', observed: headersPresent ? '보안 헤더 확인됨' : '보안 헤더 확인되지 않음' },
  ];
}
