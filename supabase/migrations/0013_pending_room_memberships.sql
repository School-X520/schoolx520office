CREATE TABLE IF NOT EXISTS public.pending_room_memberships (
  email text NOT NULL REFERENCES public.allowed_users(email) ON DELETE CASCADE,
  room_id text NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'observer')),
  assigned_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (email, room_id)
);

CREATE INDEX IF NOT EXISTS idx_pending_room_memberships_email
ON public.pending_room_memberships(email);

ALTER TABLE public.pending_room_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY pending_room_memberships_admin_all ON public.pending_room_memberships
FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

WITH latest_pending_audit AS (
  SELECT DISTINCT ON (
    lower(COALESCE(metadata #>> '{membership,email}', metadata ->> 'email')),
    COALESCE(metadata #>> '{membership,roomId}', metadata ->> 'roomId')
  )
    action,
    lower(COALESCE(metadata #>> '{membership,email}', metadata ->> 'email')) AS email,
    COALESCE(metadata #>> '{membership,roomId}', metadata ->> 'roomId') AS room_id,
    COALESCE(metadata #>> '{membership,role}', 'member') AS role,
    actor_user_id AS assigned_by,
    created_at
  FROM public.audit_logs
  WHERE action IN ('pending_room_membership.upsert', 'pending_room_membership.removed')
    AND (
      metadata #>> '{membership,email}' IS NOT NULL
      OR metadata ->> 'email' IS NOT NULL
    )
  ORDER BY
    lower(COALESCE(metadata #>> '{membership,email}', metadata ->> 'email')),
    COALESCE(metadata #>> '{membership,roomId}', metadata ->> 'roomId'),
    created_at DESC
)
INSERT INTO public.pending_room_memberships (email, room_id, role, assigned_by, created_at, updated_at)
SELECT latest.email, latest.room_id, latest.role, latest.assigned_by, latest.created_at, latest.created_at
FROM latest_pending_audit latest
JOIN public.allowed_users allowed ON lower(allowed.email) = latest.email
WHERE latest.action = 'pending_room_membership.upsert'
  AND latest.email IS NOT NULL
  AND latest.room_id IS NOT NULL
  AND allowed.is_active = true
ON CONFLICT (email, room_id)
DO UPDATE SET
  role = EXCLUDED.role,
  assigned_by = EXCLUDED.assigned_by,
  updated_at = EXCLUDED.updated_at;

CREATE OR REPLACE FUNCTION public.apply_pending_room_memberships(target_email text, target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.room_memberships (user_id, room_id, role)
  SELECT target_user_id, pending.room_id, pending.role
  FROM public.pending_room_memberships pending
  WHERE lower(pending.email) = lower(target_email)
  ON CONFLICT (user_id, room_id)
  DO UPDATE SET role = CASE
    WHEN public.room_memberships.role = 'admin' THEN 'admin'
    ELSE EXCLUDED.role
  END;

  DELETE FROM public.pending_room_memberships pending
  WHERE lower(pending.email) = lower(target_email);
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowed record;
  display_name text;
BEGIN
  SELECT *
  INTO allowed
  FROM public.allowed_users
  WHERE lower(email) = lower(NEW.email)
    AND is_active = true;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  display_name := COALESCE(
    NEW.raw_user_meta_data ->> 'name',
    NEW.raw_user_meta_data ->> 'full_name',
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO public.user_profiles (user_id, email, display_name, avatar_url, is_admin)
  VALUES (
    NEW.id,
    lower(NEW.email),
    display_name,
    NEW.raw_user_meta_data ->> 'avatar_url',
    COALESCE(allowed.is_admin, false)
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    email = EXCLUDED.email,
    display_name = COALESCE(EXCLUDED.display_name, public.user_profiles.display_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.user_profiles.avatar_url),
    is_admin = public.user_profiles.is_admin OR EXCLUDED.is_admin;

  IF COALESCE(allowed.is_admin, false) THEN
    INSERT INTO public.room_memberships (user_id, room_id, role)
    SELECT NEW.id, id, 'admin'
    FROM public.rooms
    WHERE is_active = true
    ON CONFLICT (user_id, room_id)
    DO UPDATE SET role = 'admin';
  ELSE
    INSERT INTO public.room_memberships (user_id, room_id, role)
    VALUES (NEW.id, 'meeting', 'member')
    ON CONFLICT (user_id, room_id)
    DO UPDATE SET role = CASE
      WHEN public.room_memberships.role = 'admin' THEN 'admin'
      ELSE EXCLUDED.role
    END;
  END IF;

  PERFORM public.apply_pending_room_memberships(NEW.email, NEW.id);

  RETURN NEW;
END;
$$;
