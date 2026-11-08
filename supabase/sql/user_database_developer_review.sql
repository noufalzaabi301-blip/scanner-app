-- ---------------------------------------------------------------------------
-- supabase/sql/user_database_developer_review.sql
-- Run in the SQL editor of the USER database project (accounts,
-- preferences, Avoid List, product_submissions, admin_users).
--
-- Roles:
--   Normal users  – may submit their own products (only when they opted in,
--                   which the app checks) and read their own submissions.
--   Developers    – users listed in public.admin_users. May read pending
--                   submissions and "Save draft" corrections while a
--                   submission is still pending.
--   Approve / reject – only the Edge Functions (service role) may set
--                   approved / rejected. Nobody can do that from the app.
--
-- Safe to run more than once.
-- ---------------------------------------------------------------------------

-- 1. Developer list (kept in the user database).
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

-- A user may only see whether THEY are a developer (used to show the
-- developer screen). Nobody can add developers from the app.
drop policy if exists "Users can see their own admin row" on public.admin_users;
create policy "Users can see their own admin row"
  on public.admin_users
  for select
  to authenticated
  using (user_id = auth.uid());

revoke insert, update, delete on table public.admin_users from anon, authenticated;

-- 2. Helper used by the policies below.
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

-- 3. Product submissions.
alter table public.product_submissions enable row level security;

-- Normal users: submit their own products as "pending".
drop policy if exists "Users can submit their own products" on public.product_submissions;
create policy "Users can submit their own products"
  on public.product_submissions
  for insert
  to authenticated
  with check (
    submitted_by = auth.uid()
    and coalesce(verification_status, 'pending') = 'pending'
  );

-- Normal users see their own submissions; developers see all of them.
drop policy if exists "Users and developers can read submissions" on public.product_submissions;
create policy "Users and developers can read submissions"
  on public.product_submissions
  for select
  to authenticated
  using (submitted_by = auth.uid() or public.is_admin());

-- Developers: "Save draft" while the submission is pending. The row must
-- still be pending afterwards, so approval cannot be faked from the app.
drop policy if exists "Developers can save drafts" on public.product_submissions;
create policy "Developers can save drafts"
  on public.product_submissions
  for update
  to authenticated
  using (public.is_admin() and verification_status = 'pending')
  with check (public.is_admin() and verification_status = 'pending');

-- No deletes from the app.
revoke delete on table public.product_submissions from anon, authenticated;

-- Add a developer (run manually, with the user's id from Authentication):
-- insert into public.admin_users (user_id) values ('USER-UUID-HERE');
