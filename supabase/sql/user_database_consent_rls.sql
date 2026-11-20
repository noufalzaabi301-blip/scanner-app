-- ---------------------------------------------------------------------------
-- supabase/sql/user_database_consent_rls.sql
-- Run in the SQL editor of the USER database project ONLY
-- (the project in EXPO_PUBLIC_SUPABASE_URL). Never in the food project.
--
-- Run supabase/sql/user_database_inspect.sql first and check that the
-- columns below exist with these names:
--   user_preferences:    user_id, prefers_halal, submit_products_for_review,
--                        has_allergies, allergies, other_allergy, updated_at
--   product_submissions: submitted_by, verification_status, barcode, …
--   admin_users:         user_id
--
-- What this does (nothing is deleted: no users, preferences, products or
-- submissions are removed; only policies created by LabelLens scripts are
-- replaced):
--   1. user_preferences: each user can read, create and update ONLY their
--      own row (needed by the app's preference screens and the
--      "Send scanned products for verification" switch).
--   2. product_submissions: a user can insert a submission ONLY for
--      themselves, ONLY as "pending", and ONLY while their
--      submit_products_for_review setting is true. Before, the app checked
--      this but the database did not.
--   3. Users read their own submissions; developers (public.admin_users,
--      via public.is_admin()) read all and may save drafts while pending —
--      unchanged from user_database_developer_review.sql.
--   4. Nobody can approve / reject or delete from the app: only the
--      approve-/reject-product-submission Edge Functions (service role) can.
--
-- The food database is not touched here. Its products table must stay
-- read-only for app users: run supabase/sql/food_database_read_only.sql in
-- the FOOD project (the project in EXPO_PUBLIC_PRODUCT_SUPABASE_URL).
--
-- Safe to run more than once. Runs in one transaction.
-- ---------------------------------------------------------------------------

begin;

-- ---------------------------------------------------------------------------
-- 0. Helpers
-- ---------------------------------------------------------------------------

-- Developer check (same as user_database_developer_review.sql).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users where user_id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Has the signed-in user turned on "Send scanned products for
-- verification"? A missing row means NO.
create or replace function public.has_submission_consent()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.submit_products_for_review
       from public.user_preferences p
      where p.user_id = auth.uid()),
    false
  );
$$;

revoke all on function public.has_submission_consent() from public;
grant execute on function public.has_submission_consent() to authenticated;

-- ---------------------------------------------------------------------------
-- 1. user_preferences: own row only
-- ---------------------------------------------------------------------------

alter table public.user_preferences enable row level security;

-- Safe defaults: the switches are never NULL for new rows.
alter table public.user_preferences
  alter column prefers_halal set default false,
  alter column submit_products_for_review set default false;

drop policy if exists "Users can read their own preferences" on public.user_preferences;
create policy "Users can read their own preferences"
  on public.user_preferences
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can create their own preferences" on public.user_preferences;
create policy "Users can create their own preferences"
  on public.user_preferences
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can update their own preferences" on public.user_preferences;
create policy "Users can update their own preferences"
  on public.user_preferences
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- RESTRICTIVE guard: combined with AND with every other policy, so even an
-- older broad policy (e.g. "Enable read access for all users") can no
-- longer expose or change another user's preferences.
drop policy if exists "Preferences: own row only" on public.user_preferences;
create policy "Preferences: own row only"
  on public.user_preferences
  as restrictive
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update on table public.user_preferences to authenticated;
revoke all on table public.user_preferences from anon;
-- Account deletion uses the delete-account Edge Function (service role).
revoke delete on table public.user_preferences from authenticated;

-- ---------------------------------------------------------------------------
-- 2. product_submissions: insert only with consent, as "pending"
-- ---------------------------------------------------------------------------

alter table public.product_submissions enable row level security;

-- New rows start as "pending" when the app does not send a status.
alter table public.product_submissions
  alter column verification_status set default 'pending';

drop policy if exists "Users can submit their own products" on public.product_submissions;
create policy "Users can submit their own products"
  on public.product_submissions
  for insert
  to authenticated
  with check (
    submitted_by = auth.uid()
    and coalesce(verification_status, 'pending') = 'pending'
    and public.has_submission_consent()
  );

-- RESTRICTIVE guard for inserts: combined with AND with every other insert
-- policy, so an older broad policy (e.g. "Enable insert for authenticated
-- users only") can no longer bypass the consent check. Reads and developer
-- drafts are not affected.
drop policy if exists "Submissions require consent" on public.product_submissions;
create policy "Submissions require consent"
  on public.product_submissions
  as restrictive
  for insert
  to authenticated
  with check (
    submitted_by = auth.uid()
    and coalesce(verification_status, 'pending') = 'pending'
    and public.has_submission_consent()
  );

-- Users: their own submissions. Developers: all submissions.
drop policy if exists "Users and developers can read submissions" on public.product_submissions;
create policy "Users and developers can read submissions"
  on public.product_submissions
  for select
  to authenticated
  using (submitted_by = auth.uid() or public.is_admin());

-- Developers: "Save draft" only while pending (approval cannot be faked).
drop policy if exists "Developers can save drafts" on public.product_submissions;
create policy "Developers can save drafts"
  on public.product_submissions
  for update
  to authenticated
  using (public.is_admin() and verification_status = 'pending')
  with check (public.is_admin() and verification_status = 'pending');

grant select, insert, update on table public.product_submissions to authenticated;
revoke delete on table public.product_submissions from anon, authenticated;
revoke all on table public.product_submissions from anon;

-- The Edge Functions use the service role (bypasses RLS, needs grants).
grant select, insert, update, delete on table public.user_preferences to service_role;
grant select, insert, update, delete on table public.product_submissions to service_role;

commit;

-- ---------------------------------------------------------------------------
-- After running: older policies are kept (nothing is dropped except the
-- LabelLens policies re-created above). The two RESTRICTIVE policies make
-- sure old broad policies can no longer bypass "own row only" for
-- preferences or the consent check for submissions. To review what exists:
--
-- select tablename, policyname, permissive, cmd, roles, qual, with_check
-- from pg_policies
-- where schemaname = 'public'
--   and tablename in ('user_preferences', 'product_submissions')
-- order by tablename, cmd;
-- ---------------------------------------------------------------------------
