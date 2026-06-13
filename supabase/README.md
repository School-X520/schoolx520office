# Supabase Notes

`supabase/migrations/`의 **모든** 마이그레이션을 파일명 숫자 순서대로 빠짐없이 적용한다
(`0001_initial_schema.sql`부터 최신까지). 일부만 나열하면 목록이 금방 낡으므로 개별 번호를 적지 않는다.
`supabase db push` 또는 SQL 에디터로 순서대로 실행할 것.

주의:
- 마이그레이션 멱등성이 일관되지 않다(`0008`은 `IF NOT EXISTS` 없이 컬럼을 추가) — 깨끗한 DB에 한 번,
  순서대로 적용하는 것을 전제로 한다. 부분 적용 후 재실행은 안전하지 않을 수 있다.
- Storage 버킷(`workspace-files`)과 `storage.objects` RLS는 현재 마이그레이션 밖(수동 프로비저닝)이다.
  버킷은 반드시 **private**으로 만들고(공개 시 PII 파일 노출), 접근은 서명 URL로만 한다.

service role 키는 서버 측 래퍼에서만 사용한다. 브라우저 클라이언트는 `host_url`, service role 자격증명,
Anthropic 키, Google/Zoom 시크릿을 받지 않는다(현재 모든 쿼리가 service-role이라 RLS는 휴면 방어다).
