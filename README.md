# BYTE BACK 방어전 시작 틀 R5

## 현재 작업: 6단계 등록 기기 판정

`docs/DECIDER_REQUEST.md`의 subjectId는 운영 서버가 확인한 가명 사용자이며 Supabase userId와 직접 대조하지 않습니다. deviceRegistered는 운영 서버가 확인한 기기 등록 값입니다. `src/decider.mjs`는 true인 경우만 allow·approved, false·누락은 deny·device_not_registered로 반환합니다. RULE_IDS에는 구현한 device_registered만 있습니다. 인증서·CA·개인키를 만들지 않았고 별도 접속 앱 설치도 없습니다.

`npm run decider:test`에서 등록 기기의 정상 요청과 미등록 기기의 거부 결과를 확인합니다. 이는 로컬 가상 요청 연습이며 실제 mTLS 통로 공격이나 공식 심판 통과를 증명하지 않습니다. 기존 배포 주소와 자료실 화면은 유지하며, 5단계 서버 로그인은 90점 기본 통과 후 가점을 재심사 중입니다.

2단계의 가상 자료 네 건과 vault_notes 테이블은 보존했습니다. 최신 정적 파일에 메모 원문을 포함하지 않습니다. 2~4단계 최근 제출은 공식 검사에서 완결성 100점이었습니다. Supabase Auth 로그인·로그아웃과 제공 검증기를 유지하며 모든 메모 API를 검증된 소유자로 제한합니다. 브라우저의 자료 직접 호출은 없었고, 5단계에서는 notes의 PUBLIC·anon·authenticated 직접 권한을 모두 회수합니다. 원본 HTTPS 경로는 aleph.config.json에 기록했습니다.

Node.js 24에서 `npm ci`, `npm run test:app`, `npm run build -- --local` 순으로 실행합니다. 화면은 로그인 후 메모 추가, 각 메모의 수정·삭제, 로그아웃 순으로 확인합니다. 5단계 기본 조건은 공식 90점으로 통과했습니다. 이어 로그인도 서버 함수로 이동했습니다. 공식 @supabase/ssr SDK가 요청별 HttpOnly·Secure·SameSite=Lax 쿠키로 로그인·갱신·로그아웃을 처리합니다. 브라우저에는 Supabase 키나 JWT를 보내지 않습니다. 서버는 변경하지 않은 제공 도우미 src/verify-login.mjs로 메모 요청의 토큰을 검증하고, 클라이언트가 보낸 userId·role·owner_id를 신뢰하지 않습니다.

Vercel의 SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY는 Production·Preview에 설정돼 있습니다. 서버 키는 Secret이며 Git에 넣지 않습니다. 실제 주소는 https://choi-bujang-secret-vault-peach.vercel.app 입니다. identityProvider와 실제 GET/POST/PUT/DELETE 경로는 aleph.config.json에 기록했습니다. 명령을 실행하지 않은 새 환경이나 실제 계정 A의 이메일·비밀번호 로그인은 검증 완료로 쓰지 않습니다.

notes 테이블은 기존 가상 자료와 분리됩니다. 비로그인 자료 요청은 401 JSON, 상대 소유 메모는 404, 다른 owner_id를 주장한 생성·수정은 403입니다. 본인 CRUD는 서버 전용 권한으로 유지합니다. 4단계 RLS는 유지하되 5단계에서 authenticated CRUD 권한도 회수합니다. service_role만 CRUD할 수 있고 API에서 소유자를 확인합니다. 실제 A/B 이메일 화면 시험은 미검증이며 로컬 모의 시험과 구분합니다. [4단계 기록](docs/STAGE4_OWNERSHIP.md)은 당시 정책의 이력입니다. 쿠키로 인증하는 변경 요청은 등록된 배포 출처만 허용합니다. Authorization 헤더가 있으면 쿠키로 덮어쓰지 않으며 제공 검증기가 별도로 확인합니다.

과거 공개 이력의 한계는 [설명 문서](docs/STATIC_HISTORY_LIMITS.md)를 참고하세요. 아래 내용은 1단계 시작 방식의 기록입니다.

이 저장소는 1단계에서 학생 본인이 GitHub 저장소와 Vercel 배포를 만드는 출발점입니다. 포함된 메모 네 건은 가상 자료입니다. 실제 학생 자료, 토큰, 비밀키를 넣지 마세요.

## 학생이 하는 일: 세 걸음

1. GitHub 계정을 만듭니다.
2. 방어전 1단계 카드의 **Deploy** 버튼을 누릅니다. Vercel에 GitHub로 로그인하고, 새 저장소가 **본인 계정의 Public 저장소**인지 확인한 뒤 Deploy를 누릅니다.
3. 배포가 끝나면 화면에 나온 `https://…vercel.app` 주소를 방어전 1단계 카드에 붙여넣고 제출합니다. 저장소 주소나 설정 파일은 적지 않습니다.

배포가 끝나면 `/`에서 점령된 가상 자료실을 볼 수 있습니다. `/data.json`에는 같은 가상 메모가 공개됩니다. 이 공개 상태를 확인하는 것이 1단계의 출발점입니다. 1단계 접수와 심판 판정은 포털에서 확인합니다.

## 시작 틀의 자동 처리

`vercel.json`은 정적 결과물 `public`을 배포합니다. 빌드 명령 `npm run build`는 Vercel이 제공하는 GitHub 저장소 소유자·이름, 커밋 SHA, 배포 URL을 검증하고 `public/aleph.json`을 생성합니다. 이 값이 없으면 빌드가 실패하므로, 성공한 것처럼 빈 주소를 내보내지 않습니다. `aleph.json`의 내용만으로 저장소 소유권이나 방어 성공을 인정하지 않습니다. 심판이 공개 저장소의 실제 커밋과 배포된 자료를 따로 대조해야 합니다.

`aleph.config.json`의 `repoUrl`과 `publicAppUrl`은 이전 제출 묶음 방식의 자리표시자입니다. 1단계에서는 학생이 편집하지 않습니다. 2단계 이후 코딩 도구가 필요한 설정과 보호 기능을 단계별로 작성합니다. `npm run bundle`과 `bundle-notes.json`도 1단계의 세 걸음에는 포함되지 않습니다.

로컬에서 가상 화면만 확인할 때는 `npm run build -- --local`을 사용합니다. 로컬 실행은 Vercel 배포나 심판 접수를 증명하지 않습니다. 저장소의 `src/attack-check.mjs`는 실제 배포가 된 뒤 `/data.json`을 비로그인으로 요청해 공개 가상 메모의 확인 표시를 읽습니다.

## 다음 단계의 코딩 도구에 전달할 규칙

[AGENTS.md](AGENTS.md)를 먼저 읽히고 한 번에 한 제작 단위만 요청하세요. 2단계부터는 자료 보호를 구현할 때 `public/data.json`을 복사하는 1단계 빌드 흐름도 함께 바꿔야 합니다. 3단계 이후의 로그인, 허용 경로, 5단계의 원본 API 주소, 6단계 이후 정책 규칙은 해당 단계 원고와 계약에 맞춰 추가합니다. 비밀번호·토큰·서버 전용 키·실제 학생 기록을 코드, Git, 제출 묶음에 넣지 않습니다.

`src/decider.mjs`와 `src/detect.mjs`의 로컬 시험은 반 엔진이나 운영 심판의 결과가 아닙니다. 1단계 이후 제출 묶음 계약 `aleph.defense.submission.v2`는 `scripts/bundle.mjs`에 남아 있으며, 코딩 도구가 해당 단계의 최신 배포 주소와 Git 원격을 맞춘 뒤 사용합니다.
