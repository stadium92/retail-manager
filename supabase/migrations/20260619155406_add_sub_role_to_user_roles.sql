-- Add sub_role column to user_roles table if it does not exist
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS sub_role TEXT;
