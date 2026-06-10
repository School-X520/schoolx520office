-- FK/역방향 조회 인덱스 보강.
-- 0001에서 핫패스 인덱스는 만들었으나, 권한 판정·역참조·부모 삭제 경로의
-- FK 컬럼 인덱스가 다수 누락되어 데이터 증가 시 순차 스캔으로 저하된다.
-- 모두 IF NOT EXISTS로 멱등 적용.

-- room_memberships(room_id): PK가 (user_id, room_id)라 room_id 선두 조회 불가.
-- is_room_member 등 권한 함수와 방별 멤버 조회의 토대.
CREATE INDEX IF NOT EXISTS idx_room_memberships_room ON public.room_memberships(room_id);

-- agent_runs FK 역참조/필터.
CREATE INDEX IF NOT EXISTS idx_agent_runs_initiated_by ON public.agent_runs(initiated_by);
CREATE INDEX IF NOT EXISTS idx_agent_runs_agent ON public.agent_runs(agent_id);

-- room_messages.agent_run_id: run으로 메시지 역추적 + agent_runs 삭제 시 무결성 검사.
CREATE INDEX IF NOT EXISTS idx_room_messages_agent_run ON public.room_messages(agent_run_id);

-- agent_tool_calls(agent_run_id): 0001에서 인덱스 누락(events/versions와 달리).
CREATE INDEX IF NOT EXISTS idx_agent_tool_calls_run ON public.agent_tool_calls(agent_run_id);

-- decisions(room_id): listDecisions 빈번 조회.
CREATE INDEX IF NOT EXISTS idx_decisions_room ON public.decisions(room_id);

-- shared_items.source_room_id: 0001은 target만 인덱싱했으나 조회는 source/target OR.
CREATE INDEX IF NOT EXISTS idx_shared_items_source ON public.shared_items(source_room_id, created_at DESC);

-- file_derivations 양방향 참조.
CREATE INDEX IF NOT EXISTS idx_file_derivations_source ON public.file_derivations(source_file_id);
CREATE INDEX IF NOT EXISTS idx_file_derivations_derived ON public.file_derivations(derived_file_id);
