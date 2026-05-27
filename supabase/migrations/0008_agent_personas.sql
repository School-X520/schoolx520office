ALTER TABLE public.agents
  ADD COLUMN persona_draft jsonb DEFAULT '{}',
  ADD COLUMN persona_published jsonb DEFAULT '{}',
  ADD COLUMN persona_draft_updated_by uuid REFERENCES auth.users(id),
  ADD COLUMN persona_draft_updated_at timestamptz,
  ADD COLUMN persona_published_by uuid REFERENCES auth.users(id),
  ADD COLUMN persona_published_at timestamptz;

UPDATE public.agents
SET
  persona_draft = jsonb_build_object(
    'role', COALESCE(system_prompt, role, name),
    'tone', '신중하고 간결한 한국어로 답한다.',
    'outputStyle', '먼저 결론을 짧게 말하고, 필요한 다음 행동을 bullet로 정리한다.',
    'priorities', COALESCE(role, name) || '의 업무 목표, 일정, 산출물 품질을 우선한다.',
    'boundaries', '학생 개인정보, 계정, API 키, 내부 민감정보를 출력하지 않는다.',
    'customInstructions', '',
    'guestPrompt', COALESCE(guest_prompt, '회의방에서는 5문장 이내로 출처와 다음 행동을 포함해 브리핑한다.')
  ),
  persona_published = jsonb_build_object(
    'role', COALESCE(system_prompt, role, name),
    'tone', '신중하고 간결한 한국어로 답한다.',
    'outputStyle', '먼저 결론을 짧게 말하고, 필요한 다음 행동을 bullet로 정리한다.',
    'priorities', COALESCE(role, name) || '의 업무 목표, 일정, 산출물 품질을 우선한다.',
    'boundaries', '학생 개인정보, 계정, API 키, 내부 민감정보를 출력하지 않는다.',
    'customInstructions', '',
    'guestPrompt', COALESCE(guest_prompt, '회의방에서는 5문장 이내로 출처와 다음 행동을 포함해 브리핑한다.')
  )
WHERE persona_draft = '{}'::jsonb
   OR persona_published = '{}'::jsonb;

CREATE TABLE public.agent_persona_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id text NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  room_id text NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  version_no int NOT NULL,
  persona jsonb NOT NULL,
  anthropic_agent_id text,
  anthropic_agent_version int,
  published_by uuid REFERENCES auth.users(id),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  UNIQUE (agent_id, version_no)
);

CREATE INDEX idx_agent_persona_versions_agent_created
ON public.agent_persona_versions(agent_id, created_at DESC);

ALTER TABLE public.agent_persona_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY agent_persona_versions_member_read ON public.agent_persona_versions
FOR SELECT USING (public.is_room_member(auth.uid(), room_id));

CREATE POLICY agent_persona_versions_room_admin_insert ON public.agent_persona_versions
FOR INSERT WITH CHECK (public.is_room_admin(auth.uid(), room_id));
