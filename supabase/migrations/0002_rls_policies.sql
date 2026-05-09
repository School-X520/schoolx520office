CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = uid AND is_admin = true);
$$;

CREATE OR REPLACE FUNCTION public.is_room_member(uid uuid, rid text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.room_memberships WHERE user_id = uid AND room_id = rid)
    OR rid = 'meeting';
$$;

CREATE OR REPLACE FUNCTION public.is_room_admin(uid uuid, rid text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.room_memberships WHERE user_id = uid AND room_id = rid AND role = 'admin');
$$;

CREATE OR REPLACE FUNCTION public.can_access_file(uid uuid, fid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.file_room_access fra
    WHERE fra.file_id = fid AND public.is_room_member(uid, fra.room_id)
  );
$$;

CREATE POLICY allowed_users_admin_all ON public.allowed_users
FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY user_profiles_self_read ON public.user_profiles
FOR SELECT USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY user_profiles_self_update ON public.user_profiles
FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY rooms_read_active ON public.rooms
FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = true);

CREATE POLICY room_memberships_self_read ON public.room_memberships
FOR SELECT USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY room_memberships_admin_all ON public.room_memberships
FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY agents_room_read ON public.agents
FOR SELECT USING (public.is_room_member(auth.uid(), room_id));

CREATE POLICY room_messages_member_read ON public.room_messages
FOR SELECT USING (public.is_room_member(auth.uid(), room_id));
CREATE POLICY room_messages_member_insert ON public.room_messages
FOR INSERT WITH CHECK (sender_user_id = auth.uid() AND public.is_room_member(auth.uid(), room_id));

CREATE POLICY agent_runs_member_read ON public.agent_runs
FOR SELECT USING (public.is_room_member(auth.uid(), room_id));
CREATE POLICY agent_run_events_member_read ON public.agent_run_events
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.agent_runs ar WHERE ar.id = agent_run_id AND public.is_room_member(auth.uid(), ar.room_id))
);

CREATE POLICY domain_memory_member_read ON public.domain_memory
FOR SELECT USING (public.is_room_member(auth.uid(), room_id));
CREATE POLICY memory_history_member_read ON public.memory_history
FOR SELECT USING (public.is_room_member(auth.uid(), room_id));
CREATE POLICY room_memory_stores_member_read ON public.room_memory_stores
FOR SELECT USING (public.is_room_member(auth.uid(), room_id));
CREATE POLICY memory_write_reviews_admin_or_room_admin ON public.memory_write_reviews
FOR SELECT USING (public.is_admin(auth.uid()) OR public.is_room_admin(auth.uid(), room_id));

CREATE POLICY files_access_read ON public.files
FOR SELECT USING (public.can_access_file(auth.uid(), id));
CREATE POLICY file_versions_access_read ON public.file_versions
FOR SELECT USING (public.can_access_file(auth.uid(), file_id));
CREATE POLICY file_derivations_access_read ON public.file_derivations
FOR SELECT USING (public.can_access_file(auth.uid(), source_file_id) OR public.can_access_file(auth.uid(), derived_file_id));
CREATE POLICY file_room_access_member_read ON public.file_room_access
FOR SELECT USING (public.is_room_member(auth.uid(), room_id));
CREATE POLICY message_attachments_member_read ON public.message_attachments
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.room_messages rm WHERE rm.id = message_id AND public.is_room_member(auth.uid(), rm.room_id))
);

CREATE POLICY shared_items_read ON public.shared_items
FOR SELECT USING (
  public.is_room_member(auth.uid(), source_room_id)
  OR public.is_room_member(auth.uid(), target_room_id)
  OR public.is_room_member(auth.uid(), 'meeting')
);
CREATE POLICY meeting_imports_read ON public.meeting_imports
FOR SELECT USING (
  public.is_room_member(auth.uid(), target_room_id)
  OR public.is_room_member(auth.uid(), meeting_room_id)
);

CREATE POLICY decisions_member_read ON public.decisions
FOR SELECT USING (public.is_room_member(auth.uid(), room_id));
CREATE POLICY decisions_member_insert ON public.decisions
FOR INSERT WITH CHECK (public.is_room_member(auth.uid(), room_id));
CREATE POLICY decisions_author_or_admin_update ON public.decisions
FOR UPDATE USING (decided_by = auth.uid() OR public.is_room_admin(auth.uid(), room_id));

CREATE POLICY tasks_member_read ON public.tasks
FOR SELECT USING (public.is_room_member(auth.uid(), room_id) OR public.is_room_member(auth.uid(), assignee_room_id));
CREATE POLICY tasks_member_insert ON public.tasks
FOR INSERT WITH CHECK (public.is_room_member(auth.uid(), room_id));
CREATE POLICY tasks_assignee_or_admin_update ON public.tasks
FOR UPDATE USING (
  assignee_user_id = auth.uid()
  OR created_by = auth.uid()
  OR public.is_room_admin(auth.uid(), room_id)
);

CREATE POLICY audit_logs_admin_read ON public.audit_logs
FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY agent_tool_calls_member_read ON public.agent_tool_calls
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.agent_runs ar WHERE ar.id = agent_run_id AND public.is_room_member(auth.uid(), ar.room_id))
);
