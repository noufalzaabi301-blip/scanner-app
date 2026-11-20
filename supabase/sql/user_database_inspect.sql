-- ---------------------------------------------------------------------------
-- supabase/sql/user_database_inspect.sql
-- READ-ONLY. Run in the SQL editor of the USER database project
-- (your USER project → SQL Editor).
--
-- Shows the real tables, columns, Row Level Security switches, policies and
-- grants for the customer tables, so the migration
-- (user_database_consent_rls.sql) can be checked against the live database
-- before it is run. Changes nothing.
-- ---------------------------------------------------------------------------

-- 1. Columns of the customer tables.
select table_name, ordinal_position, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('user_preferences', 'product_submissions', 'avoid_list', 'admin_users')
order by table_name, ordinal_position;

-- 2. Is Row Level Security switched on?
select c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('user_preferences', 'product_submissions', 'avoid_list', 'admin_users')
order by c.relname;

-- 3. Existing policies (cmd, roles and the exact conditions).
select tablename, policyname, permissive, cmd, roles,
       qual as using_condition,
       with_check as with_check_condition
from pg_policies
where schemaname = 'public'
  and tablename in ('user_preferences', 'product_submissions', 'avoid_list', 'admin_users')
order by tablename, cmd, policyname;

-- 4. Table privileges for the app roles.
select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('user_preferences', 'product_submissions', 'avoid_list', 'admin_users')
  and grantee in ('anon', 'authenticated', 'service_role')
group by table_name, grantee
order by table_name, grantee;

-- 5. Constraints / unique indexes (user_id key, duplicate protection).
select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid in (
  'public.user_preferences'::regclass,
  'public.product_submissions'::regclass
)
order by 1, 2;

select tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('user_preferences', 'product_submissions')
order by tablename, indexname;

-- 6. Status values currently in use.
select verification_status, count(*) as submissions
from public.product_submissions
group by verification_status
order by verification_status;

-- 7. Helper functions used by the policies.
select proname, prosecdef as security_definer
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('is_admin', 'has_submission_consent');
