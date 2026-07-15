-- 20260620183100_add_roles_to_enum.sql
-- Add enum values to public.app_role type
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'cashier';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'cook';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'waiter';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'waiters';

-- Update existing user roles in user_roles table
UPDATE public.user_roles SET role = 'cashier' WHERE role = 'worker' AND sub_role = 'cashier';
UPDATE public.user_roles SET role = 'cook' WHERE role = 'worker' AND sub_role = 'cook';
UPDATE public.user_roles SET role = 'waiter' WHERE role = 'worker' AND sub_role = 'waiter';
UPDATE public.user_roles SET role = 'waiters' WHERE role = 'worker' AND sub_role = 'waiters';
