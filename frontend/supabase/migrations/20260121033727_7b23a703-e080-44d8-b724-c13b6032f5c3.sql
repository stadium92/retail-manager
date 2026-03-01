-- Drop the problematic trigger that auto-assigns master role to all users
DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;

-- Create a new smarter function that only assigns master role for self-signups
-- (when the user signs up directly, not when created by admin API)
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only auto-assign master role if the user signed up directly (no created_by metadata)
  -- Users created via admin API will have their role assigned by the edge function
  IF NOT EXISTS (
    SELECT 1 FROM new.raw_user_meta_data WHERE new.raw_user_meta_data->>'created_by' IS NOT NULL
  ) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, 'master'::app_role)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN new;
END;
$$;

-- Recreate the trigger with the updated function
CREATE TRIGGER on_auth_user_created_role
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION handle_new_user_role();

-- Clean up duplicate master roles for users who should only be workers
-- Delete the auto-created master roles for users who have a worker role with a store_id
DELETE FROM public.user_roles 
WHERE role = 'master' 
AND store_id IS NULL 
AND user_id IN (
  SELECT user_id FROM public.user_roles WHERE role = 'worker' AND store_id IS NOT NULL
);