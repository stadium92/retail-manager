-- Relax Profiles RLS to allow all authenticated users to view names
-- This fixes issues where workers appear as "Unknown" if RLS is too strict
DROP POLICY IF EXISTS "Masters can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "Authenticated can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Safety Net: Ensure the first user (Owner/Dev) has the Master role
-- This fixes the "Fake Master" issue where frontend thinks user is Master but DB doesn't
DO $$
DECLARE
  first_user_id UUID;
BEGIN
  -- Get the oldest user
  SELECT id INTO first_user_id
  FROM auth.users
  ORDER BY created_at ASC
  LIMIT 1;

  IF first_user_id IS NOT NULL THEN
    -- Insert master role if not exists
    INSERT INTO public.user_roles (user_id, role)
    VALUES (first_user_id, 'master')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;
