# 2단계 데이터베이스 준비 기록

조직: sonjunhyek_frist_snsproject. 사용자 선택에 따라 과제용 aleph-defense-vault를 준비했습니다. FoodStory는 변경하지 않았습니다.

프로젝트 참조: epiirbcbtjvmyewuetkt

서버용 API 주소: https://epiirbcbtjvmyewuetkt.supabase.co

연결 상태: ACTIVE_HEALTHY. Postgres 17.11에 실제 질의를 실행했습니다. public 스키마가 비어 있음을 확인한 뒤 create_server_only_vault_notes 마이그레이션으로 테이블을 만들었습니다.

vault_notes는 UUID id, 정렬 position, title, content, created_at 열을 가집니다. 1단계의 공개 가능한 가상 메모 네 건을 데이터베이스로 옮겼고 원문은 이 문서와 소스에 복사하지 않았습니다. 브라우저가 읽는 정적 JSON 원본 두 파일을 제거했습니다.

- RLS: 활성화.
- anon/authenticated: 테이블 권한 없음. anon 역할의 실제 SELECT는 42501 permission denied로 거부됨.
- service_role: SELECT만 명시적으로 부여. 해당 역할로 실제 count 조회 4건 확인.
- 브라우저 역할에 대한 허용 정책 없음. 서버 전용이므로 의도된 제한입니다. 보안 점검기의 rls_enabled_no_policy 안내는 이 설계에 해당합니다. [해당 안내 설명](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

서버 자격은 저장소에 보관하지 않습니다. 배포 담당자는 Supabase 공식 설정에서 서버 전용 키를 확인한 뒤 Vercel 프로젝트의 서버 환경변수 SUPABASE_SECRET_KEY에 직접 설정합니다. SUPABASE_URL은 위 주소입니다. 키 자체를 채팅·로그·문서·제출 묶음에 붙여 넣지 않습니다.

기존 JWT 형식의 서버 키를 쓰는 환경은 SUPABASE_SERVICE_ROLE_KEY를 대신 지원합니다. 둘 중 하나만 설정합니다. 두 변수 모두 브라우저 공개 접두사를 붙이지 않습니다. API가 응답할 때 DB 내부 오류·헤더·키를 포함하지 않습니다.

새 배포에서 API를 호출하는 검증은 아직 미실행입니다. 현재 자료실 API의 비로그인 가상 자료 읽기는 2단계 범위이며, 이후 로그인·소유자 제어를 별도로 적용해야 합니다. [Supabase의 API 권한·RLS 설명](https://supabase.com/docs/guides/api/securing-your-api).
