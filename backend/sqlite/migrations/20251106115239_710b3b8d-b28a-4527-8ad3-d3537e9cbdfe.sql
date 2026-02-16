-- Auto-generated from 20251106115239_710b3b8d-b28a-4527-8ad3-d3537e9cbdfe.sql
-- Review required: verify constraints and triggers for SQLite compatibility.

-- Fix linter: set explicit search_path format and keep role trigger
create or replace function handle_new_user_role()
returns trigger
language plpgsql
security definer

  return new;
end;
$$;

-- Backfill: ensure existing users without roles get a global master role
insert into user_roles (user_id, role)
select u.id, 'master'::app_role
from auth.users u
where not exists (
  select 1 from user_roles r where r.user_id = u.id
)
on conflict do nothing;
