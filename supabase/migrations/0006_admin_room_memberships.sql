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

  RETURN NEW;
END;
$$;

INSERT INTO public.room_memberships (user_id, room_id, role)
SELECT profile.user_id, room.id, 'admin'
FROM public.user_profiles profile
CROSS JOIN public.rooms room
WHERE profile.is_admin = true
  AND room.is_active = true
ON CONFLICT (user_id, room_id)
DO UPDATE SET role = 'admin';
