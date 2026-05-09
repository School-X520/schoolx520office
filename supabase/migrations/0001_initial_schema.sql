CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.allowed_users (
  email text PRIMARY KEY,
  invited_by uuid NULL REFERENCES auth.users(id),
  invited_at timestamptz DEFAULT now(),
  notes text,
  is_active boolean DEFAULT true
);

CREATE TABLE public.user_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text,
  avatar_url text,
  is_admin boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.rooms (
  id text PRIMARY KEY,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('department','project','meeting')),
  icon text,
  description text,
  default_model text,
  display_order int,
  layout_x int,
  layout_y int,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.room_memberships (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  room_id text REFERENCES public.rooms(id) ON DELETE CASCADE,
  role text CHECK (role IN ('admin','member','observer')) DEFAULT 'member',
  joined_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, room_id)
);

CREATE TABLE public.agents (
  id text PRIMARY KEY,
  room_id text REFERENCES public.rooms(id),
  name text NOT NULL,
  role text,
  anthropic_agent_id text,
  anthropic_environment_id text,
  default_model text,
  system_prompt text,
  guest_prompt text,
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.room_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text REFERENCES public.rooms(id) ON DELETE CASCADE,
  sender_user_id uuid REFERENCES auth.users(id),
  sender_agent_id text REFERENCES public.agents(id),
  agent_run_id uuid,
  type text CHECK (type IN ('human','agent','guest_agent','shared_item','meeting_import','system','video_meeting')),
  content text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text REFERENCES public.rooms(id),
  agent_id text REFERENCES public.agents(id),
  initiated_by uuid REFERENCES auth.users(id),
  anthropic_session_id text,
  mode text CHECK (mode IN ('room','meeting_guest','finalizer','memory_review')) NOT NULL,
  run_type text CHECK (run_type IN ('room_agent','meeting_guest','finalizer','memory_review','video_meeting_summary')) DEFAULT 'room_agent',
  guest_source_room_id text REFERENCES public.rooms(id),
  status text CHECK (status IN ('queued','running','requires_action','idle','completed','failed','cancelled')) DEFAULT 'queued',
  input_message_id uuid REFERENCES public.room_messages(id),
  output_message_id uuid REFERENCES public.room_messages(id),
  session_summary text,
  token_usage jsonb DEFAULT '{}',
  error text,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  metadata jsonb DEFAULT '{}'
);

ALTER TABLE public.room_messages
  ADD CONSTRAINT room_messages_agent_run_id_fkey
  FOREIGN KEY (agent_run_id) REFERENCES public.agent_runs(id);

CREATE TABLE public.agent_run_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_run_id uuid REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  anthropic_event_id text,
  event_type text,
  payload jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.domain_memory (
  room_id text PRIMARY KEY REFERENCES public.rooms(id) ON DELETE CASCADE,
  summary text,
  active_tasks jsonb DEFAULT '[]',
  decisions jsonb DEFAULT '[]',
  key_facts jsonb DEFAULT '[]',
  pending_context jsonb DEFAULT '[]',
  processed_context jsonb DEFAULT '[]',
  metadata jsonb DEFAULT '{}',
  updated_at timestamptz DEFAULT now(),
  updated_by_agent_run uuid REFERENCES public.agent_runs(id)
);

CREATE TABLE public.memory_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text REFERENCES public.rooms(id) ON DELETE CASCADE,
  agent_run_id uuid REFERENCES public.agent_runs(id),
  before jsonb,
  after jsonb,
  diff jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.room_memory_stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text REFERENCES public.rooms(id) ON DELETE CASCADE,
  anthropic_memory_store_id text,
  access_mode text CHECK (access_mode IN ('read_only','read_write')) DEFAULT 'read_write',
  purpose text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.memory_write_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text REFERENCES public.rooms(id),
  agent_run_id uuid REFERENCES public.agent_runs(id),
  proposed_memory jsonb NOT NULL,
  status text CHECK (status IN ('pending','approved','rejected','applied')) DEFAULT 'pending',
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path text NOT NULL,
  original_name text NOT NULL,
  uploaded_by uuid REFERENCES auth.users(id),
  size_bytes bigint,
  mime_type text,
  checksum text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.file_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id uuid REFERENCES public.files(id) ON DELETE CASCADE,
  version_no int NOT NULL,
  storage_path text NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  agent_run_id uuid REFERENCES public.agent_runs(id),
  change_summary text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (file_id, version_no)
);

CREATE TABLE public.file_derivations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_file_id uuid REFERENCES public.files(id),
  derived_file_id uuid REFERENCES public.files(id),
  reason text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.file_room_access (
  file_id uuid REFERENCES public.files(id) ON DELETE CASCADE,
  room_id text REFERENCES public.rooms(id) ON DELETE CASCADE,
  access_level text CHECK (access_level IN ('read','write','owner')) DEFAULT 'read',
  added_by uuid REFERENCES auth.users(id),
  added_at timestamptz DEFAULT now(),
  PRIMARY KEY (file_id, room_id)
);

CREATE TABLE public.message_attachments (
  message_id uuid REFERENCES public.room_messages(id) ON DELETE CASCADE,
  file_id uuid REFERENCES public.files(id) ON DELETE CASCADE,
  PRIMARY KEY (message_id, file_id)
);

CREATE TABLE public.shared_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_room_id text REFERENCES public.rooms(id),
  target_room_id text REFERENCES public.rooms(id) DEFAULT 'meeting',
  source_message_id uuid REFERENCES public.room_messages(id),
  source_file_id uuid REFERENCES public.files(id),
  title text NOT NULL,
  summary text,
  shared_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'
);

CREATE TABLE public.meeting_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_room_id text REFERENCES public.rooms(id) DEFAULT 'meeting',
  target_room_id text REFERENCES public.rooms(id),
  shared_item_id uuid REFERENCES public.shared_items(id),
  source_message_id uuid REFERENCES public.room_messages(id),
  source_file_id uuid REFERENCES public.files(id),
  imported_by uuid REFERENCES auth.users(id),
  status text CHECK (status IN ('pending','processed','dismissed')) DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'
);

CREATE TABLE public.decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text REFERENCES public.rooms(id),
  source_message_id uuid REFERENCES public.room_messages(id),
  title text NOT NULL,
  description text,
  decided_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text REFERENCES public.rooms(id),
  decision_id uuid REFERENCES public.decisions(id),
  title text NOT NULL,
  description text,
  assignee_user_id uuid REFERENCES auth.users(id),
  assignee_room_id text REFERENCES public.rooms(id),
  status text CHECK (status IN ('todo','doing','done','cancelled')) DEFAULT 'todo',
  due_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES auth.users(id),
  actor_agent_id text REFERENCES public.agents(id),
  room_id text REFERENCES public.rooms(id),
  action text NOT NULL,
  target_type text,
  target_id text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.agent_tool_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_run_id uuid REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  tool_name text NOT NULL,
  input jsonb DEFAULT '{}',
  output jsonb DEFAULT '{}',
  status text CHECK (status IN ('pending','allowed','denied','completed','failed')) DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX idx_room_messages_room_created ON public.room_messages(room_id, created_at DESC);
CREATE INDEX idx_agent_runs_room_status ON public.agent_runs(room_id, status, started_at DESC);
CREATE INDEX idx_agent_run_events_run_created ON public.agent_run_events(agent_run_id, created_at DESC);
CREATE INDEX idx_files_uploaded_by ON public.files(uploaded_by);
CREATE INDEX idx_file_room_access_room ON public.file_room_access(room_id);
CREATE INDEX idx_shared_items_target ON public.shared_items(target_room_id, created_at DESC);
CREATE INDEX idx_meeting_imports_target ON public.meeting_imports(target_room_id, status);
CREATE INDEX idx_tasks_room_status ON public.tasks(room_id, status);
CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at DESC);

CREATE TRIGGER user_profiles_updated_at BEFORE UPDATE ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER agents_updated_at BEFORE UPDATE ON public.agents
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER domain_memory_updated_at BEFORE UPDATE ON public.domain_memory
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER room_memory_stores_updated_at BEFORE UPDATE ON public.room_memory_stores
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.allowed_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_run_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_memory_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_write_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_derivations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_room_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_tool_calls ENABLE ROW LEVEL SECURITY;
