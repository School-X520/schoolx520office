-- is_room_member()가 meeting 방에 대해 멤버십과 무관하게 true를 반환하던 폴백 제거.
-- 모든 승인 사용자는 handle_new_user()(0005)가 meeting 멤버십을 자동 부여하므로 폴백이 불필요하며,
-- 비활성/비승인 인증 사용자에게 meeting 방 데이터가 RLS 레벨에서 노출되는 구멍만 만든다.
CREATE OR REPLACE FUNCTION public.is_room_member(uid uuid, rid text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.room_memberships WHERE user_id = uid AND room_id = rid);
$$;
