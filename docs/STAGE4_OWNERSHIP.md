# 4단계: 사용자별 자료

제공 로그인 검증기를 그대로 사용합니다. 목록·단건 조회·수정·삭제는 모두 검증된 userId로 owner_id를 제한합니다. 수정의 WHERE에 id와 owner_id를 함께 넣고 새 행 owner_id도 같은 검증된 ID로 고정합니다. 다른 소유자의 ID는 없는 ID와 같이 404로 응답합니다. POST/PUT에서 다른 owner_id를 주장하면 403입니다. userId·role로 권한을 올릴 수 없습니다.

`STAGE4_RLS.sql`은 notes 테이블만 변경합니다. authenticated는 CRUD만 허용하며 SELECT/DELETE의 USING, INSERT의 WITH CHECK, UPDATE의 양쪽 조건에 auth.uid()를 대조합니다. anon은 모든 권한을 회수합니다. service_role도 CRUD만 남기지만 RLS를 우회하므로 API 소유자 조건을 생략할 수 없습니다.

2단계 vault_notes의 공개 가능한 가상 메모 네 건은 그대로 보존합니다. 실제 A/B 이메일을 제공받지 않았으므로 auth.users 이메일 조회·학습 메모 소유자 이관은 실행하지 않았습니다. 임의 계정이나 실제 개인정보를 만들지 않습니다. 심판이 생성한 A/B 메모로 API 분리 여부를 판정합니다.

검증: `npm run test:app`은 로컬 ES256 모의 신원 A/B 각각의 CRUD와 상대 자료 조회·수정·삭제 거부, 소유자 변경 거부를 시험합니다. 실제 이메일 로그인 화면 시험과 공식 심판은 별개입니다. 화면은 로그인 → 메모 추가 → 수정·삭제 → 로그아웃 순서입니다. 정상 본인 자료는 표시되고, 비로그인 요청은 401 JSON, 상대 자료는 404여야 합니다.

DB 적용 전 anon/authenticated에는 notes 권한이 없었습니다. 적용 후 역할 권한·RLS 결과는 배포 검증 기록에 별도 남깁니다. 공식 참고: https://supabase.com/docs/guides/database/postgres/row-level-security
