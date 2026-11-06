-- ---------------------------------------------------------------------------
-- supabase/sql/user_database_delete_account.sql
-- Run in the SQL editor of the USER (customer) project only:
--   https://supabase.com/dashboard/project/lqbbbzoleutjhlfkljae/sql
--
-- Fixes "permission denied for table avoid_list" (Postgres error 42501)
-- in the delete-account Edge Function.
--
-- Why: the service_role skips Row Level Security, but it still needs normal
-- table GRANTs. Projects where new tables are not exposed to the Data API
-- automatically, or tables whose grants were revoked, give service_role no
-- rights, so the function's deletes fail.
--
-- What this changes: it only GRANTs table rights to service_role (used by
-- Edge Functions on the server, never by the app). It does NOT give anon or
-- authenticated users any new rights, and it changes no RLS policies.
-- Safe to run more than once. Tables that do not exist are skipped.
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'avoid_list',
    'user_preferences',
    'product_submissions',
    'admin_users'
  ]
  loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format(
        'grant select, insert, update, delete on table public.%I to service_role',
        t
      );
      raise notice 'service_role granted on public.%', t;
    else
      raise notice 'public.% does not exist, skipped', t;
    end if;
  end loop;
end
$$;

grant usage on schema public to service_role;

-- Check (should list DELETE for service_role on every table above):
-- select table_name, privilege_type
-- from information_schema.role_table_grants
-- where grantee = 'service_role'
--   and table_schema = 'public'
--   and table_name in ('avoid_list', 'user_preferences', 'product_submissions', 'admin_users')
-- order by table_name, privilege_type;
