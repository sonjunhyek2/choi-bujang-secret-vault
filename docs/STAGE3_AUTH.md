# 3단계 인증·메모 계약

Supabase 프로젝트는 기존 epiirbcbtjvmyewuetkt를 사용합니다. 공식 SDK signInWithPassword와 signOut으로 이메일·비밀번호 로그인·로그아웃을 수행합니다. 비밀번호나 JWT를 직접 만들거나 서버 키를 브라우저에 넣지 않습니다.

서버의 src/verify-login.mjs는 제공 원본 그대로입니다. src/notes-runtime.mjs가 이를 createLoginVerifier로 연결합니다. Supabase 사용자는 공식 Auth getClaims 검증을 거치며, 심판 토큰은 제공 도우미의 등록된 issuer·JWKS·audience·만료·서명 검증을 거칩니다. 단순 decode 결과로 사용자를 승인하지 않습니다.

| 메서드 | 경로 | 계약 |
|---|---|---|
| GET | /api/notes | 검증된 로그인 사용자의 메모 배열 |
| POST | /api/notes | {id?,title,body}, UUID 생략시 서버 생성, 응답 {id} |
| GET | /api/notes/:id | {id,title,body} 또는 404 |
| PUT | /api/notes/:id | 제목·내용 수정 |
| DELETE | /api/notes/:id | 삭제, 이후 같은 ID GET은 404 |

미인증 또는 검증 실패는 자료 없이 401 JSON 오류입니다. owner_id는 검증된 사용자 ID로 저장하고, 요청 본문의 userId·role·owner_id는 사용하지 않습니다. 목록은 본인 것으로 제한합니다. 단건 접근의 소유권 제어는 공식 안내가 지정한 4단계 작업이며 현재 구현된 것으로 쓰지 않습니다.

create_authenticated_notes_stage3 원격 마이그레이션으로 public.notes를 만들었습니다. id UUID, owner_id UUID, title, body, created_at을 가지며 RLS를 켰습니다. 브라우저 역할 anon/authenticated에는 테이블 직접 권한이 없고 서버 역할에 CRUD를 부여했습니다. 이 서버 전용 구성의 정책 없음 INFO는 외부 사용자용 허용 정책을 추가해야 한다는 뜻으로 오해하지 않습니다. 기존 vault_notes의 가상 자료 4건은 변경하지 않았습니다.

로컬 npm run test:app는 모의 ES256 심판 토큰으로 제공 검증 도우미의 정상·누락·다른 audience·만료·잘못된 서명 및 CRUD 계약을 검사합니다. 시험용 키는 실행 중 메모리에서 생성하고 외부 심판이나 사용자 로그인 성공으로 보고하지 않습니다. 실제 A 계정의 이메일·비밀번호 로그인과 브라우저 CRUD는 아직 별도 확인이 필요합니다. npm run bundle의 자기 점검은 실제 배포에 보낸 비로그인·잘못된 토큰 요청만 기록합니다.
