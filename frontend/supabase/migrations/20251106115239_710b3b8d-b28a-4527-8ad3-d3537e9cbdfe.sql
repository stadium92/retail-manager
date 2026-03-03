-- Fix linter: set explicit search_path format and keep role trigger
create or replace function public.handle_new_user_role()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.user_roles (user_id, role)
  values (new.id, 'master'::app_role)
  on conflict do nothing;
  return new;
end;
$$;

-- Backfill: ensure existing users without roles get a global master role
insert into public.user_roles (user_id, role)
select u.id, 'master'::app_role
from auth.users u
where not exists (
  select 1 from public.user_roles r where r.user_id = u.id
)
on conflict do nothing;