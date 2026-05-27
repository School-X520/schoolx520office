INSERT INTO public.allowed_users (email, invited_by, notes, is_active, is_admin)
VALUES (
  'devyongt@gmail.com',
  NULL,
  'Initial School-X administrator',
  true,
  true
)
ON CONFLICT (email)
DO UPDATE SET
  is_active = true,
  is_admin = true,
  notes = COALESCE(public.allowed_users.notes, EXCLUDED.notes);

UPDATE public.user_profiles
SET is_admin = true
WHERE lower(email) = 'devyongt@gmail.com';

INSERT INTO public.room_memberships (user_id, room_id, role)
SELECT profile.user_id, room.id, 'admin'
FROM public.user_profiles profile
CROSS JOIN public.rooms room
WHERE lower(profile.email) = 'devyongt@gmail.com'
  AND room.is_active = true
ON CONFLICT (user_id, room_id)
DO UPDATE SET role = 'admin';
