CREATE TABLE public.video_meeting_providers (
  id text PRIMARY KEY,
  name text NOT NULL,
  enabled boolean DEFAULT true,
  supports_embed boolean DEFAULT false,
  supports_recordings boolean DEFAULT false,
  supports_transcripts boolean DEFAULT false,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.room_video_settings (
  room_id text PRIMARY KEY REFERENCES public.rooms(id) ON DELETE CASCADE,
  default_provider text REFERENCES public.video_meeting_providers(id),
  allow_recording boolean DEFAULT false,
  allow_transcript boolean DEFAULT false,
  allow_ai_summary boolean DEFAULT true,
  auto_create_summary_card boolean DEFAULT true,
  metadata jsonb DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.video_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  provider text NOT NULL REFERENCES public.video_meeting_providers(id),
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','live','ended','canceled','failed')),
  provider_space_name text,
  provider_conference_name text,
  provider_meeting_id text,
  provider_meeting_code text,
  join_url text,
  host_url text, -- sensitive: never return to normal client responses.
  embed_allowed boolean DEFAULT false,
  scheduled_start_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  ended_by uuid REFERENCES auth.users(id),
  consent_recording boolean DEFAULT false,
  consent_transcript boolean DEFAULT false,
  consent_ai_summary boolean DEFAULT true,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.video_meeting_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_meeting_id uuid NOT NULL REFERENCES public.video_meetings(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  provider_participant_id text,
  display_name text,
  email text,
  role text DEFAULT 'participant',
  joined_at timestamptz,
  left_at timestamptz,
  duration_seconds int,
  metadata jsonb DEFAULT '{}'
);

CREATE TABLE public.video_meeting_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_meeting_id uuid NOT NULL REFERENCES public.video_meetings(id) ON DELETE CASCADE,
  artifact_type text NOT NULL CHECK (artifact_type IN ('recording','transcript','transcript_entry','ai_summary','manual_minutes','provider_metadata')),
  title text,
  content text,
  external_url text,
  file_id uuid REFERENCES public.files(id),
  provider_artifact_name text,
  status text DEFAULT 'available' CHECK (status IN ('pending','available','failed','restricted')),
  created_by uuid REFERENCES auth.users(id),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.video_meeting_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_meeting_id uuid REFERENCES public.video_meetings(id) ON DELETE CASCADE,
  room_id text REFERENCES public.rooms(id),
  event_type text NOT NULL,
  actor_user_id uuid REFERENCES auth.users(id),
  payload jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_video_meetings_room_status_created ON public.video_meetings(room_id, status, created_at DESC);
CREATE INDEX idx_video_meeting_participants_meeting ON public.video_meeting_participants(video_meeting_id);
CREATE INDEX idx_video_meeting_artifacts_meeting_type ON public.video_meeting_artifacts(video_meeting_id, artifact_type);
CREATE INDEX idx_video_meeting_events_meeting_created ON public.video_meeting_events(video_meeting_id, created_at DESC);

CREATE TRIGGER video_meeting_providers_updated_at BEFORE UPDATE ON public.video_meeting_providers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER room_video_settings_updated_at BEFORE UPDATE ON public.room_video_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER video_meetings_updated_at BEFORE UPDATE ON public.video_meetings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.video_meeting_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_video_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_meeting_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_meeting_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_meeting_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY video_providers_read ON public.video_meeting_providers
FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY room_video_settings_member_read ON public.room_video_settings
FOR SELECT USING (public.is_room_member(auth.uid(), room_id));
CREATE POLICY video_meetings_member_read ON public.video_meetings
FOR SELECT USING (public.is_room_member(auth.uid(), room_id));
CREATE POLICY video_meetings_member_insert ON public.video_meetings
FOR INSERT WITH CHECK (public.is_room_member(auth.uid(), room_id));
CREATE POLICY video_artifacts_member_read ON public.video_meeting_artifacts
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.video_meetings vm WHERE vm.id = video_meeting_id AND public.is_room_member(auth.uid(), vm.room_id))
);
CREATE POLICY video_events_member_read ON public.video_meeting_events
FOR SELECT USING (public.is_room_member(auth.uid(), room_id));
CREATE POLICY video_participants_member_read ON public.video_meeting_participants
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.video_meetings vm WHERE vm.id = video_meeting_id AND public.is_room_member(auth.uid(), vm.room_id))
);

INSERT INTO public.video_meeting_providers (id, name, enabled, supports_embed, supports_recordings, supports_transcripts)
VALUES
  ('google_meet', 'Google Meet', true, false, true, true),
  ('zoom', 'Zoom', false, true, true, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.room_video_settings (room_id, default_provider, allow_recording, allow_transcript, allow_ai_summary)
VALUES ('meeting', 'google_meet', false, false, true)
ON CONFLICT (room_id) DO NOTHING;
