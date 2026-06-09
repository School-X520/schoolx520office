UPDATE public.rooms
SET display_order = 8, layout_x = 1, layout_y = 4
WHERE id = 'province_research';

UPDATE public.rooms
SET display_order = 10, layout_x = 3, layout_y = 4
WHERE id = 'science_museum';

INSERT INTO public.rooms (id, name, type, icon, description, default_model, display_order, layout_x, layout_y, is_active)
VALUES (
  'gwangju_hanam_research',
  '광주하남교육연구회',
  'project',
  '🏫',
  '광주하남교육연구회 산출물과 협의 내용을 관리합니다.',
  'claude-sonnet-4-5',
  9,
  2,
  4,
  true
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  icon = EXCLUDED.icon,
  description = EXCLUDED.description,
  default_model = EXCLUDED.default_model,
  display_order = EXCLUDED.display_order,
  layout_x = EXCLUDED.layout_x,
  layout_y = EXCLUDED.layout_y,
  is_active = EXCLUDED.is_active;

INSERT INTO public.agents (
  id,
  room_id,
  name,
  role,
  default_model,
  system_prompt,
  guest_prompt,
  is_active,
  metadata
)
VALUES (
  'gwangju_hanam_research_bot',
  'gwangju_hanam_research',
  '광주하남봇',
  '광주하남교육연구회 도메인 봇',
  'claude-sonnet-4-5',
  '광주하남교육연구회 업무를 총괄한다. 개인정보와 민감정보를 무단 공유하지 않고, 자기 분야 밖의 결정을 단정하지 않는다.',
  '회의방에서는 비전문가도 이해할 수 있게 짧게 브리핑하고 출처와 다음 행동을 제안한다.',
  true,
  '{}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  room_id = EXCLUDED.room_id,
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  default_model = EXCLUDED.default_model,
  system_prompt = EXCLUDED.system_prompt,
  guest_prompt = EXCLUDED.guest_prompt,
  is_active = EXCLUDED.is_active,
  updated_at = now();

INSERT INTO public.domain_memory (room_id, summary)
VALUES ('gwangju_hanam_research', '광주하남교육연구회 초기 요약 캐시입니다.')
ON CONFLICT (room_id) DO NOTHING;

INSERT INTO public.room_memory_stores (room_id, anthropic_memory_store_id, purpose)
SELECT 'gwangju_hanam_research', NULL, '광주하남교육연구회 Claude Memory Store placeholder'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.room_memory_stores
  WHERE room_id = 'gwangju_hanam_research'
);

INSERT INTO public.room_threads (room_id, title, summary, carryover_summary, last_message_at, metadata)
SELECT
  'gwangju_hanam_research',
  '광주하남교육연구회 기본 대화',
  COALESCE(dm.summary, ''),
  COALESCE(dm.summary, ''),
  now(),
  jsonb_build_object('seeded', true, 'kind', 'default')
FROM public.domain_memory dm
WHERE dm.room_id = 'gwangju_hanam_research'
  AND NOT EXISTS (
    SELECT 1
    FROM public.room_threads
    WHERE room_id = 'gwangju_hanam_research'
  );

INSERT INTO public.room_memberships (user_id, room_id, role)
SELECT profile.user_id, 'gwangju_hanam_research', 'admin'
FROM public.user_profiles profile
WHERE profile.is_admin = true
ON CONFLICT (user_id, room_id)
DO UPDATE SET role = 'admin';
