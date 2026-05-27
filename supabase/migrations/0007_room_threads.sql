CREATE TABLE public.room_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  title text NOT NULL,
  summary text DEFAULT '',
  carryover_summary text DEFAULT '',
  status text CHECK (status IN ('active','archived')) DEFAULT 'active',
  last_message_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

INSERT INTO public.room_threads (room_id, title, summary, carryover_summary, last_message_at, metadata)
SELECT
  r.id,
  r.name || ' 기본 대화',
  COALESCE(dm.summary, ''),
  COALESCE(dm.summary, ''),
  COALESCE(MAX(rm.created_at), now()),
  jsonb_build_object('seeded', true, 'kind', 'default')
FROM public.rooms r
LEFT JOIN public.domain_memory dm ON dm.room_id = r.id
LEFT JOIN public.room_messages rm ON rm.room_id = r.id
GROUP BY r.id, r.name, dm.summary
ON CONFLICT DO NOTHING;

ALTER TABLE public.room_messages
  ADD COLUMN thread_id uuid REFERENCES public.room_threads(id) ON DELETE SET NULL;

UPDATE public.room_messages rm
SET thread_id = (
  SELECT rt.id
  FROM public.room_threads rt
  WHERE rt.room_id = rm.room_id
  ORDER BY rt.created_at ASC
  LIMIT 1
)
WHERE rm.thread_id IS NULL;

ALTER TABLE public.room_messages
  ALTER COLUMN thread_id SET NOT NULL;

ALTER TABLE public.agent_runs
  ADD COLUMN thread_id uuid REFERENCES public.room_threads(id) ON DELETE SET NULL;

UPDATE public.agent_runs ar
SET thread_id = (
  SELECT rt.id
  FROM public.room_threads rt
  WHERE rt.room_id = ar.room_id
  ORDER BY rt.created_at ASC
  LIMIT 1
)
WHERE ar.thread_id IS NULL;

ALTER TABLE public.agent_runs
  ALTER COLUMN thread_id SET NOT NULL;

CREATE INDEX idx_room_threads_room_status ON public.room_threads(room_id, status, last_message_at DESC);
CREATE INDEX idx_room_messages_thread_created ON public.room_messages(thread_id, created_at ASC);
CREATE INDEX idx_agent_runs_thread_started ON public.agent_runs(thread_id, started_at DESC);

CREATE TRIGGER room_threads_updated_at BEFORE UPDATE ON public.room_threads
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.room_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY room_threads_member_read ON public.room_threads
FOR SELECT USING (public.is_room_member(auth.uid(), room_id));

CREATE POLICY room_threads_member_insert ON public.room_threads
FOR INSERT WITH CHECK (public.is_room_member(auth.uid(), room_id));

CREATE POLICY room_threads_member_update ON public.room_threads
FOR UPDATE USING (public.is_room_member(auth.uid(), room_id))
WITH CHECK (public.is_room_member(auth.uid(), room_id));
