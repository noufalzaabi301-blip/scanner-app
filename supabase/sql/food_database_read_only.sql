-- ---------------------------------------------------------------------------
-- supabase/sql/food_database_read_only.sql
-- Run in the SQL editor of the FOOD database project (not the user one).
--
-- Makes public.products read-only for the app:
--   - anon / authenticated may only SELECT approved products (scanner);
--   - nobody using the publishable key can INSERT, UPDATE or DELETE.
-- New products are added only by the approve-product-submission Edge
-- Function, which uses FOOD_SUPABASE_SERVICE_ROLE_KEY. The service role
-- bypasses RLS and keeps its own privileges, so it is not affected.
--
-- Safe to run more than once.
-- ---------------------------------------------------------------------------

-- 1. Table privileges: read only for app clients.
revoke insert, update, delete, truncate, references, trigger
  on table public.products
  from anon, authenticated;

grant select on table public.products to anon, authenticated;

-- The approve-product-submission Edge Function connects as service_role.
-- Make sure it can still write (it bypasses RLS but needs table grants).
grant select, insert, update, delete on table public.products to service_role;

-- 2. Row Level Security: only approved products are visible.
alter table public.products enable row level security;

drop policy if exists "Scanner can read approved products" on public.products;

create policy "Scanner can read approved products"
  on public.products
  for select
  to anon, authenticated
  using (verification_status = 'approved');

-- Remove any old policies that allowed app clients to write.
do $$
declare
  policy record;
begin
  for policy in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'products'
      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  loop
    execute format('drop policy %I on public.products', policy.policyname);
  end loop;
end $$;

-- 3. Barcodes must be unique, so two approvals can never create duplicates
--    (the Edge Function also checks before inserting).
create unique index if not exists products_barcode_unique
  on public.products (barcode);

-- Check (should list only the SELECT policy):
-- select policyname, cmd, roles from pg_policies where tablename = 'products';
-- Check (anon/authenticated should only have SELECT):
-- select grantee, privilege_type from information_schema.role_table_grants
-- where table_name = 'products' and grantee in ('anon', 'authenticated');
