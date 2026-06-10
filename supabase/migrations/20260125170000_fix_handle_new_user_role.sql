-- Fix handle_new_user_role trigger function that was blocking sign ups
BEGIN;

CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  created_by TEXT;
BEGIN
  -- When raw_user_meta_data is null, treat it as self-signup (no created_by)
  IF NEW.raw_user_meta_data IS NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'master'::app_role)
    ON CONFLICT DO NOTHING;
    RETURN NEW;
  END IF;

  created_by := NEW.raw_user_meta_data->>'created_by';

  IF created_by IS NULL OR created_by = '' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'master'::app_role)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
