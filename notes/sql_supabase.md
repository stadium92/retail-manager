command:
SELECT id FROM auth.users WHERE email = 'Sissoko@example.com';
answer:
Query succeeded. No rows returned.

command:
SELECT user_id, role, store_id FROM public.user_roles WHERE user_id = 'USER_ID';
answer:
Query failed
Failed to run sql query: ERROR:  42P01: relation "public.user_roles" does not exist
LINE 1: SELECT user_id, role, store_id FROM public.user_roles WHERE user_id = 'USER_ID';
                                            ^
command:
SELECT schemaname, tablename, policyname, qual, with_check
FROM pg_policies
WHERE tablename = 'products';
answer:
Query succeeded. No rows returned.

command:
DROP POLICY IF EXISTS "Masters can manage products" ON public.products;
CREATE POLICY "Masters can manage products"
ON public.products FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'master'))
WITH CHECK (public.has_role(auth.uid(), 'master'));

DROP POLICY IF EXISTS "Workers can view store products" ON public.products;
CREATE POLICY "Workers can view store products"
ON public.products FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'worker')
  AND store_id IN (SELECT public.get_user_store_ids(auth.uid()))
);

DROP POLICY IF EXISTS "Workers can insert store products" ON public.products;
CREATE POLICY "Workers can insert store products"
ON public.products FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'worker')
  AND store_id IN (SELECT public.get_user_store_ids(auth.uid()))
);

DROP POLICY IF EXISTS "Workers can update store products" ON public.products;
CREATE POLICY "Workers can update store products"
ON public.products FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'worker')
  AND store_id IN (SELECT public.get_user_store_ids(auth.uid()))
)
WITH CHECK (
  public.has_role(auth.uid(), 'worker')
  AND store_id IN (SELECT public.get_user_store_ids(auth.uid()))
);
answer:
Query failed
Failed to run sql query: ERROR:  42P01: relation "public.products" does not exist

command:
INSERT INTO public.user_roles (user_id, role, store_id)
VALUES ('USER_ID', 'worker', 'STORE_ID')
ON CONFLICT (user_id, role) DO UPDATE SET store_id = EXCLUDED.store_id;
answer:
Query failed
Failed to run sql query: ERROR:  42P01: relation "public.user_roles" does not exist
LINE 1: INSERT INTO public.user_roles (user_id, role, store_id)
                    ^

command:
INSERT INTO public.user_roles (user_id, role)
VALUES ('USER_ID', 'master')
ON CONFLICT (user_id, role) DO NOTHING;
answer:
Query failed
Failed to run sql query: ERROR:  42P01: relation "public.user_roles" does not exist
LINE 1: INSERT INTO public.user_roles (user_id, role)
                    ^

command:
CREATE OR REPLACE FUNCTION public.get_user_stores(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT store_id FROM public.user_roles
  WHERE user_id = _user_id AND store_id IS NOT NULL
  UNION
  SELECT id FROM public.stores WHERE owner_id = _user_id;
$$;
answer:
Query failed
Failed to run sql query: ERROR:  42P01: relation "public.user_roles" does not exist
LINE 5:   SELECT store_id FROM public.user_roles
                               ^

command:
INSERT INTO public.products (store_id, name, unit_price, quantity)
VALUES (
  (SELECT id FROM public.stores LIMIT 1),
  'Test Product - RLS Diagnostic',
  1.00,
  1
) RETURNING id, name;
answer:
Query failed
Failed to run sql query: ERROR:  42P01: relation "public.products" does not exist
LINE 1: INSERT INTO public.products (store_id, name, unit_price, quantity)
                    ^

