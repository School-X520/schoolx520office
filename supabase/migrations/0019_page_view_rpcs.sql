-- Phase 3 (v2 리빌드 계획 5장) — "페이지당 1왕복" 읽기 RPC.
-- v1의 getRoomView는 테이블별 SELECT + JS 조인으로 방 페이지 1회에 ~18-21 RTT를 직렬 실행했다.
-- 이 마이그레이션은 그 조립을 Postgres 함수 1개로 옮겨 왕복을 1회로 줄인다.
--
-- 설계 원칙:
--  - 반환은 "원시 행(raw row, snake_case)"을 jsonb로 담는다. camelCase 매핑/기본값은
--    앱의 기존 *From 매퍼(supabase-store.ts)가 그대로 담당한다 → SQL-앱 간 매핑 이중화/드리프트 방지.
--  - host_url은 절대 반환하지 않는다(0004 DDL 경고). videoMeetings는 to_jsonb - 'host_url'.
--  - service_role로 호출된다(앱은 admin 클라이언트 사용). SECURITY DEFINER + search_path 고정.
--  - RLS 재구축(계획 Phase 1-2)은 이번 증분 범위 밖 — 권한은 앱이 requireUser로 세션을 검증하고,
--    rpc_room_view가 membership을 함께 반환해 호출부가 403/404를 판정한다.

-- ────────────────────────────────────────────────────────────────
-- 오피스 운영 상태 카운트 (당일/멤버십 스코프 집계).
-- v1 operation-status-service는 agent_runs·tasks 전테이블을 스캔했다(역사가 쌓일수록 저하).
-- 여기서는 인덱스 가능한 필터 + count 집계로 대체한다.
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_ops_counts(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH member_rooms AS (
    SELECT room_id FROM public.room_memberships WHERE user_id = p_user_id
  ),
  today AS (
    SELECT (now() AT TIME ZONE 'Asia/Seoul')::date AS d
  )
  SELECT jsonb_build_object(
    'sharedCount', (
      SELECT count(*) FROM public.shared_items si, today
      WHERE (si.source_room_id = 'meeting' OR si.target_room_id = 'meeting')
        AND (si.metadata ->> 'deletedAt') IS NULL
        AND (si.created_at AT TIME ZONE 'Asia/Seoul')::date = today.d
    ),
    'briefingCount', (
      SELECT count(*) FROM public.agent_runs ar, today
      WHERE (ar.mode = 'meeting_guest' OR ar.run_type = 'meeting_guest')
        AND ar.status = 'completed'
        AND ar.room_id IN (SELECT room_id FROM member_rooms)
        AND (ar.started_at AT TIME ZONE 'Asia/Seoul')::date = today.d
    ),
    'taskCount', (
      SELECT count(*) FROM public.tasks t
      WHERE t.status <> 'done' AND t.status <> 'cancelled'
        AND (
          t.room_id IN (SELECT room_id FROM member_rooms)
          OR (t.assignee_room_id IS NOT NULL AND t.assignee_room_id IN (SELECT room_id FROM member_rooms))
        )
    )
  );
$$;

-- ────────────────────────────────────────────────────────────────
-- 오피스 대시보드: 방·(내)멤버십·에이전트·회의방 공유함·활성 회의·운영 카운트를 1왕복에.
-- activeMeeting 후보는 status in (scheduled,live)만 반환하고, 6h 윈도우 판정은 앱(isActiveVideoMeeting)이 한다.
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_office_view(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'rooms', (
      SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.display_order), '[]'::jsonb)
      FROM public.rooms r WHERE r.is_active
    ),
    'memberships', (
      SELECT coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb)
      FROM public.room_memberships m WHERE m.user_id = p_user_id
    ),
    'agents', (
      SELECT coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb)
      FROM public.agents a WHERE a.is_active
    ),
    'sharedItems', (
      SELECT coalesce(jsonb_agg(to_jsonb(si) ORDER BY si.created_at DESC), '[]'::jsonb)
      FROM public.shared_items si
      WHERE (si.source_room_id = 'meeting' OR si.target_room_id = 'meeting')
        AND (si.metadata ->> 'deletedAt') IS NULL
    ),
    'videoMeetings', (
      SELECT coalesce(jsonb_agg((to_jsonb(vm) - 'host_url') ORDER BY vm.created_at DESC), '[]'::jsonb)
      FROM public.video_meetings vm
      WHERE vm.room_id = 'meeting' AND vm.status IN ('scheduled', 'live')
    ),
    'opsCounts', public.rpc_ops_counts(p_user_id)
  );
$$;

-- ────────────────────────────────────────────────────────────────
-- 방 뷰: RoomViewModel 조립에 필요한 모든 원시 행을 1왕복에.
-- 스레드 해석(지정 스레드 검증 / 활성 스레드 선택 / 없으면 기본 스레드 생성)을 내부에서 수행한다
-- → v1의 resolveRoomThread + ensureRoomThread + listThreads + 13개 병렬 쿼리를 대체.
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_room_view(
  p_user_id uuid,
  p_room_id text,
  p_thread_id uuid DEFAULT NULL,
  p_msg_limit int DEFAULT 200
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room       public.rooms%ROWTYPE;
  v_membership public.room_memberships%ROWTYPE;
  v_thread     public.room_threads%ROWTYPE;
  v_has_room       boolean;
  v_has_membership boolean;
  v_has_thread     boolean;
BEGIN
  SELECT * INTO v_room FROM public.rooms WHERE id = p_room_id;
  v_has_room := FOUND;

  SELECT * INTO v_membership
  FROM public.room_memberships
  WHERE room_id = p_room_id AND user_id = p_user_id;
  v_has_membership := FOUND;

  -- 방이 없거나 비멤버면 데이터 조립을 생략한다(호출부가 404/403 판정).
  IF NOT v_has_room OR NOT v_has_membership THEN
    RETURN jsonb_build_object(
      'room', CASE WHEN v_has_room THEN to_jsonb(v_room) ELSE NULL END,
      'membership', CASE WHEN v_has_membership THEN to_jsonb(v_membership) ELSE NULL END,
      'threadNotFound', false
    );
  END IF;

  -- 스레드 해석 -----------------------------------------------------
  IF p_thread_id IS NOT NULL THEN
    SELECT * INTO v_thread
    FROM public.room_threads
    WHERE id = p_thread_id AND room_id = p_room_id;
    IF NOT FOUND THEN
      -- v1 resolveRoomThread는 이 경우 404를 던진다. 호출부가 판정하도록 신호만 반환.
      RETURN jsonb_build_object(
        'room', to_jsonb(v_room),
        'membership', to_jsonb(v_membership),
        'threadNotFound', true
      );
    END IF;
  ELSE
    SELECT * INTO v_thread
    FROM public.room_threads
    WHERE room_id = p_room_id AND status = 'active'
    ORDER BY last_message_at DESC
    LIMIT 1;
    v_has_thread := FOUND;

    IF NOT v_has_thread THEN
      SELECT * INTO v_thread
      FROM public.room_threads
      WHERE room_id = p_room_id
      ORDER BY last_message_at DESC
      LIMIT 1;
      v_has_thread := FOUND;
    END IF;

    -- 스레드가 하나도 없으면 기본 스레드를 생성한다(v1 ensureRoomThread 대응).
    IF NOT v_has_thread THEN
      INSERT INTO public.room_threads (room_id, title, summary, carryover_summary, status, metadata)
      VALUES (p_room_id, '기본 대화', '', '', 'active', jsonb_build_object('kind', 'default'))
      RETURNING * INTO v_thread;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'room', to_jsonb(v_room),
    'membership', to_jsonb(v_membership),
    'threadNotFound', false,
    'userMemberships', (
      SELECT coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb)
      FROM public.room_memberships m WHERE m.user_id = p_user_id
    ),
    'rooms', (
      SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.display_order), '[]'::jsonb)
      FROM public.rooms r WHERE r.is_active
    ),
    'agents', (
      SELECT coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb)
      FROM public.agents a WHERE a.is_active
    ),
    'residentAgent', (
      SELECT to_jsonb(a) FROM public.agents a
      WHERE a.room_id = p_room_id AND a.is_active
      LIMIT 1
    ),
    'memory', (
      SELECT to_jsonb(dm) FROM public.domain_memory dm WHERE dm.room_id = p_room_id
    ),
    'activeThread', to_jsonb(v_thread),
    'threads', (
      SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.last_message_at DESC), '[]'::jsonb)
      FROM public.room_threads t WHERE t.room_id = p_room_id
    ),
    -- 최신 p_msg_limit개를 오름차순(old→new)으로. v1 listMessages(limit)의 "DESC로 뽑아 reverse"와 동일.
    'messages', (
      SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.created_at ASC, x.id ASC), '[]'::jsonb)
      FROM (
        SELECT * FROM public.room_messages
        WHERE room_id = p_room_id AND thread_id = v_thread.id
        ORDER BY created_at DESC, id DESC
        LIMIT p_msg_limit
      ) x
    ),
    -- 이 방 멤버 + 메시지 발신자의 프로필만(v1 memberProfiles 필터).
    'profiles', (
      SELECT coalesce(jsonb_agg(to_jsonb(up)), '[]'::jsonb)
      FROM public.user_profiles up
      WHERE up.user_id IN (
        SELECT user_id FROM public.room_memberships WHERE room_id = p_room_id
        UNION
        SELECT sender_user_id FROM public.room_messages
        WHERE room_id = p_room_id AND thread_id = v_thread.id AND sender_user_id IS NOT NULL
      )
    ),
    -- file_room_access ⋈ files, access_level을 평탄화(v1 fileFrom 입력 형태).
    'files', (
      SELECT coalesce(jsonb_agg(to_jsonb(f) || jsonb_build_object('access_level', fra.access_level)), '[]'::jsonb)
      FROM public.file_room_access fra
      JOIN public.files f ON f.id = fra.file_id
      WHERE fra.room_id = p_room_id
    ),
    'sharedItems', (
      SELECT coalesce(jsonb_agg(to_jsonb(si) ORDER BY si.created_at DESC), '[]'::jsonb)
      FROM public.shared_items si
      WHERE (si.source_room_id = p_room_id OR si.target_room_id = p_room_id)
        AND (si.metadata ->> 'deletedAt') IS NULL
    ),
    'imports', (
      SELECT coalesce(jsonb_agg(to_jsonb(mi) ORDER BY mi.created_at DESC), '[]'::jsonb)
      FROM public.meeting_imports mi
      WHERE (mi.meeting_room_id = p_room_id OR mi.target_room_id = p_room_id)
        AND mi.status <> 'dismissed'
    ),
    -- v1 getRoomView는 결정 목록을 항상 'meeting' 스코프로 조회한다.
    'decisions', (
      SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.created_at DESC), '[]'::jsonb)
      FROM public.decisions d WHERE d.room_id = 'meeting'
    ),
    -- 이 방에 보이는 태스크(room_id 또는 assignee_room_id 일치).
    'tasks', (
      SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC), '[]'::jsonb)
      FROM public.tasks t
      WHERE t.room_id = p_room_id OR t.assignee_room_id = p_room_id
    ),
    -- 활성 회의 후보(host_url 제거). 6h 윈도우 판정은 앱.
    'videoMeetings', (
      SELECT coalesce(jsonb_agg((to_jsonb(vm) - 'host_url') ORDER BY vm.created_at DESC), '[]'::jsonb)
      FROM public.video_meetings vm
      WHERE vm.room_id = p_room_id AND vm.status IN ('scheduled', 'live')
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_ops_counts(uuid) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_office_view(uuid) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_room_view(uuid, text, uuid, int) TO service_role, authenticated;
