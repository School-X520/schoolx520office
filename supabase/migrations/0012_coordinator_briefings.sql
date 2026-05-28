CREATE TABLE IF NOT EXISTS public.room_briefings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  agent_id text REFERENCES public.agents(id),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  summary text NOT NULL,
  risks jsonb NOT NULL DEFAULT '[]'::jsonb,
  next_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  blocked_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'ready' CHECK (status IN ('draft', 'ready', 'archived')),
  created_by uuid REFERENCES auth.users(id),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_room_briefings_room_created
ON public.room_briefings(room_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_room_briefings_period
ON public.room_briefings(period_start, period_end);

CREATE TABLE IF NOT EXISTS public.coordinator_briefings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  summary text NOT NULL,
  room_highlights jsonb NOT NULL DEFAULT '[]'::jsonb,
  cross_room_risks jsonb NOT NULL DEFAULT '[]'::jsonb,
  decisions_needed jsonb NOT NULL DEFAULT '[]'::jsonb,
  next_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_room_briefing_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  created_by uuid REFERENCES auth.users(id),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coordinator_briefings_created
ON public.coordinator_briefings(created_at DESC);

ALTER TABLE public.room_briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coordinator_briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY room_briefings_member_read ON public.room_briefings
FOR SELECT USING (
  public.is_room_member(auth.uid(), room_id)
  OR EXISTS (
    SELECT 1 FROM public.room_memberships rm
    WHERE rm.user_id = auth.uid() AND rm.room_id = 'meeting'
  )
  OR public.is_admin(auth.uid())
);

CREATE POLICY room_briefings_meeting_insert ON public.room_briefings
FOR INSERT WITH CHECK (
  created_by = auth.uid()
  AND (
    EXISTS (
      SELECT 1 FROM public.room_memberships rm
      WHERE rm.user_id = auth.uid() AND rm.room_id = 'meeting'
    )
    OR public.is_admin(auth.uid())
  )
);

CREATE POLICY coordinator_briefings_meeting_read ON public.coordinator_briefings
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.room_memberships rm
    WHERE rm.user_id = auth.uid() AND rm.room_id = 'meeting'
  )
  OR public.is_admin(auth.uid())
);

CREATE POLICY coordinator_briefings_meeting_insert ON public.coordinator_briefings
FOR INSERT WITH CHECK (
  created_by = auth.uid()
  AND (
    EXISTS (
      SELECT 1 FROM public.room_memberships rm
      WHERE rm.user_id = auth.uid() AND rm.room_id = 'meeting'
    )
    OR public.is_admin(auth.uid())
  )
);

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
  'coordinator_bot',
  'meeting',
  '총괄봇',
  '전체 업무방의 구조화 보고를 종합하는 운영 PM/회의 총괄 봇',
  'claude-sonnet-4-5',
  'School-X 교사연구회 AI Office의 총괄봇이다. 메인 회의방에서 호출될 때만 전체 업무방 보고를 종합하고, 운영 PM 관점의 진행 상황, 위험, 결정 필요 사항, 다음 행동을 간결하게 브리핑한다.',
  '메인 회의방에서 전체 업무방 진행 상황을 운영 PM 관점으로 요약한다.',
  false,
  '{"coordinator_pm": true, "all_room_search": true, "virtual_agent": true}'::jsonb
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  system_prompt = EXCLUDED.system_prompt,
  guest_prompt = EXCLUDED.guest_prompt,
  is_active = false,
  metadata = public.agents.metadata || EXCLUDED.metadata,
  updated_at = now();
