ALTER TABLE public.allowed_users
ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowed record;
  display_name text;
  meeting_role text;
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

  meeting_role := CASE WHEN COALESCE(allowed.is_admin, false) THEN 'admin' ELSE 'member' END;

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

  INSERT INTO public.room_memberships (user_id, room_id, role)
  VALUES (NEW.id, 'meeting', meeting_role)
  ON CONFLICT (user_id, room_id)
  DO UPDATE SET role = CASE
    WHEN public.room_memberships.role = 'admin' THEN 'admin'
    ELSE EXCLUDED.role
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT OR UPDATE OF email, raw_user_meta_data ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
