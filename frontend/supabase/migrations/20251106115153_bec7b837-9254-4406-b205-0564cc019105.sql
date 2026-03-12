-- Create trigger to assign default 'master' role on user creation
create or replace function public.handle_new_user_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Assign a global master role to every new user
  insert into public.user_roles (user_id, role)
  values (new.id, 'master'::app_role)
  on conflict do nothing;
  return new;
end;
$$;

-- Trigger on auth.users to assign role after signup
drop trigger if exists on_auth_user_created_role on auth.users;
create trigger on_auth_user_created_role
  after insert on auth.users
  for each row execute procedure public.handle_new_user_role();

-- Adjust restrictive SELECT policy to allow users to view their own global roles (store_id IS NULL)
drop policy if exists "Users can view roles in their stores" on public.user_roles;
create policy "Users can view roles in their stores"
  on public.user_roles
  as restrictive
  for select
  to authenticated
  using (
    (store_id in (select get_user_stores(auth.uid())))
    or (user_id = auth.uid() and store_id is null)
  );