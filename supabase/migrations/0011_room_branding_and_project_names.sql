CREATE OR REPLACE FUNCTION pg_temp.schoolx_replace_titles(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN value IS NULL THEN NULL
    ELSE replace(
      replace(
        replace(
          replace(
            replace(value, '도교육연구회 과제', '경기도교육연구회'),
            '도교육연구회',
            '경기도교육연구회'
          ),
          '과학관 과제',
          '과학관 AI교육 연구회'
        ),
        '교과연구회 AI Office',
        'School-X 교사연구회 AI Office'
      ),
      'SchoolX 플랫폼',
      'School-X 교사연구회 플랫폼'
    )
  END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.schoolx_replace_titles_json(value jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN value IS NULL THEN value
    WHEN jsonb_typeof(value) <> 'object' THEN value
    ELSE COALESCE(
      (
        SELECT jsonb_object_agg(
          key,
          CASE
            WHEN jsonb_typeof(item_value) = 'string'
              THEN to_jsonb(pg_temp.schoolx_replace_titles(item_value #>> '{}'))
            ELSE item_value
          END
        )
        FROM jsonb_each(value) AS item(key, item_value)
      ),
      '{}'::jsonb
    )
  END;
$$;

UPDATE public.rooms
SET
  name = '경기도교육연구회',
  description = '경기도교육연구회 산출물과 협의 내용을 관리합니다.',
  is_active = true
WHERE id = 'province_research';

UPDATE public.rooms
SET
  name = '과학관 AI교육 연구회',
  description = '과학관 AI교육 연구회 운영, 협력 과제, 전시/체험 자료를 정리합니다.',
  is_active = true
WHERE id = 'science_museum';

UPDATE public.rooms
SET
  name = '비활성 프로젝트방',
  description = '향후 재사용을 위해 비활성화된 프로젝트 방입니다.',
  is_active = false
WHERE id = 'city_research';

UPDATE public.agents
SET
  name = '예비봇',
  role = '비활성 프로젝트방 도메인 봇',
  system_prompt = '비활성 프로젝트방은 현재 운영하지 않는다.',
  is_active = false,
  updated_at = now()
WHERE room_id = 'city_research';

UPDATE public.agents
SET
  role = pg_temp.schoolx_replace_titles(role),
  system_prompt = pg_temp.schoolx_replace_titles(system_prompt),
  guest_prompt = pg_temp.schoolx_replace_titles(guest_prompt),
  persona_draft = pg_temp.schoolx_replace_titles_json(persona_draft),
  persona_published = pg_temp.schoolx_replace_titles_json(persona_published),
  metadata = pg_temp.schoolx_replace_titles_json(metadata),
  updated_at = now()
WHERE room_id IN ('development', 'province_research', 'science_museum');

UPDATE public.domain_memory
SET summary = pg_temp.schoolx_replace_titles(summary)
WHERE room_id IN ('development', 'province_research', 'science_museum');

UPDATE public.room_memory_stores
SET purpose = pg_temp.schoolx_replace_titles(purpose)
WHERE room_id IN ('development', 'province_research', 'science_museum');

UPDATE public.room_threads
SET
  title = pg_temp.schoolx_replace_titles(title),
  summary = pg_temp.schoolx_replace_titles(summary),
  carryover_summary = pg_temp.schoolx_replace_titles(carryover_summary)
WHERE room_id IN ('development', 'province_research', 'science_museum');

UPDATE public.agent_persona_versions
SET persona = pg_temp.schoolx_replace_titles_json(persona)
WHERE room_id IN ('development', 'province_research', 'science_museum');
