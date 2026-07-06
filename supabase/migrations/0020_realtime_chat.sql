-- Phase 4 (v2 리빌드 계획 4.3 / 5장) — "폴링 금지, 실시간 push" + "메시지 전송 1왕복".
-- v1 채팅은 4초마다 클라이언트당 5직렬 쿼리 + 전체 히스토리를 폴링했고,
-- 전송은 스레드 bump·감사 로그가 크리티컬 패스에 있어 ~7 직렬 RTT였다.
-- 이 마이그레이션은 (1) room_messages를 Supabase Realtime에 실어 push 구독을 가능케 하고,
-- (2) 전송을 트랜잭션 1왕복 RPC로 접는다.

-- ────────────────────────────────────────────────────────────────
-- 1) Realtime: room_messages insert를 구독으로 push.
--    브라우저는 로그인 시 심어진 Supabase 세션(JWT)으로 authenticated 구독을 열고,
--    room_messages의 기존 RLS(room_messages_member_read = is_room_member)가 방별로 스코프한다
--    → 비멤버는 다른 방 메시지를 구독으로도 받지 못한다(교차 방 유출 없음).
-- ────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'room_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.room_messages;
  END IF;
END $$;

-- Realtime(및 향후 RLS 경로)에서 authenticated 역할이 RLS 필터를 거쳐 읽을 수 있도록 SELECT 보장.
-- 앱의 일반 읽기는 service_role이라 지금까지 불필요했으나, 브라우저 구독은 authenticated로 동작한다.
GRANT SELECT ON public.room_messages TO authenticated;

-- ────────────────────────────────────────────────────────────────
-- 2) 메시지 전송 1왕복: 멤버십/쓰기권한 검사 → 스레드 해석 → insert → 스레드 bump → 감사로그.
--    v1 createRoomMessage(requireRoomMember + resolveRoomThread + createMessage + updateThread + addAuditLog)와
--    동작 동일. forbidden / threadNotFound는 마커로 반환해 호출부가 403/404를 판정한다.
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_send_message(
  p_user_id uuid,
  p_room_id text,
  p_thread_id uuid DEFAULT NULL,
  p_content text DEFAULT '',
  p_type text DEFAULT 'human',
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role   text;
  v_thread public.room_threads%ROWTYPE;
  v_msg    public.room_messages%ROWTYPE;
  v_found  boolean;
BEGIN
  SELECT role INTO v_role
  FROM public.room_memberships
  WHERE user_id = p_user_id AND room_id = p_room_id;

  -- 비멤버 또는 관찰자(observer)는 작성 불가(v1 canWriteRoom: admin|member).
  IF NOT FOUND OR v_role NOT IN ('admin', 'member') THEN
    RETURN jsonb_build_object('forbidden', true);
  END IF;

  -- 스레드 해석 (rpc_room_view와 동일 규칙).
  IF p_thread_id IS NOT NULL THEN
    SELECT * INTO v_thread FROM public.room_threads WHERE id = p_thread_id AND room_id = p_room_id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('threadNotFound', true);
    END IF;
  ELSE
    SELECT * INTO v_thread
    FROM public.room_threads
    WHERE room_id = p_room_id AND status = 'active'
    ORDER BY last_message_at DESC
    LIMIT 1;
    v_found := FOUND;
    IF NOT v_found THEN
      SELECT * INTO v_thread FROM public.room_threads
      WHERE room_id = p_room_id ORDER BY last_message_at DESC LIMIT 1;
      v_found := FOUND;
    END IF;
    IF NOT v_found THEN
      INSERT INTO public.room_threads (room_id, title, summary, carryover_summary, status, metadata)
      VALUES (p_room_id, '기본 대화', '', '', 'active', jsonb_build_object('kind', 'default'))
      RETURNING * INTO v_thread;
    END IF;
  END IF;

  INSERT INTO public.room_messages (room_id, thread_id, sender_user_id, type, content, metadata)
  VALUES (p_room_id, v_thread.id, p_user_id, p_type, p_content, coalesce(p_metadata, '{}'::jsonb))
  RETURNING * INTO v_msg;

  -- 스레드 bump: 마지막 메시지 시각 = 방금 insert된 메시지 created_at (v1 updateThread와 동일).
  UPDATE public.room_threads SET last_message_at = v_msg.created_at WHERE id = v_thread.id;

  -- 감사 로그(트랜잭션 내 1회 — 네트워크 왕복 추가 없음).
  INSERT INTO public.audit_logs (actor_user_id, room_id, action, target_type, target_id)
  VALUES (p_user_id, p_room_id, 'room_message.created', 'room_message', v_msg.id::text);

  RETURN jsonb_build_object('message', to_jsonb(v_msg));
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_send_message(uuid, text, uuid, text, text, jsonb) TO service_role, authenticated;
