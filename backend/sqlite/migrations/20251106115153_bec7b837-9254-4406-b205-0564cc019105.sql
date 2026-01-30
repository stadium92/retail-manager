-- Auto-generated from 20251106115153_bec7b837-9254-4406-b205-0564cc019105.sql
-- Review required: verify constraints and triggers for SQLite compatibility.

-- Create trigger to assign default 'master' role on user creation
create or replace function handle_new_user_role()
returns trigger
language plpgsql
security definer

  return new;
end;
$$;

-- Trigger on auth.users to assign role after signup
drop trigger if exists on_auth_user_created_role on auth.users;
create trigger on_auth_user_created_role
  after insert on auth.users
  for each row execute procedure handle_new_user_role();

-- Adjust restrictive SELECT policy to allow users to view their own global roles (store_id IS NULL)
drop policy if exists "Users can view roles in their stores" on user_roles;
create policy "Users can view roles in their stores"
  on user_roles
  as restrictive
  for select
  to authenticated
  using (
    (store_id in (select get_user_stores(auth.uid())))
    or (user_id = auth.uid() and store_id is null)
  );
