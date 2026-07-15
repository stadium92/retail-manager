-- Ensure profiles table has an email column for legacy triggers/functions
BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email TEXT;

COMMIT;
