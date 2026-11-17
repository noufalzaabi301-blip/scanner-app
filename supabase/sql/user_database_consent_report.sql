-- ---------------------------------------------------------------------------
-- supabase/sql/user_database_consent_report.sql
-- READ-ONLY verification queries. Run in the SQL editor of the USER
-- database project (https://lqbbbzoleutjhlfkljae.supabase.co).
-- The SQL editor runs as an administrator, so it sees all users.
--
-- Meaning:
--   user_preferences.submit_products_for_review = true → permission given
--   a row in product_submissions                       → actually submitted
--   product_submissions.verification_status           → pending / approved /
--                                                        rejected ("processing"
--                                                        = being approved now)
-- ---------------------------------------------------------------------------

-- 1. Users who turned sharing ON.
select p.user_id,
       u.email,
       p.submit_products_for_review as sharing_enabled,
       p.updated_at as preferences_updated_at
from public.user_preferences p
left join auth.users u on u.id = p.user_id
where p.submit_products_for_review = true
order by p.updated_at desc nulls last;

-- 2. Users who actually submitted products (with counts per status).
select s.submitted_by as user_id,
       u.email,
       count(*) as total_submissions,
       count(*) filter (where s.verification_status = 'pending') as pending,
       count(*) filter (where s.verification_status = 'processing') as processing,
       count(*) filter (where s.verification_status = 'approved') as approved,
       count(*) filter (where s.verification_status = 'rejected') as rejected,
       min(s.created_at) as first_submission,
       max(s.created_at) as last_submission
from public.product_submissions s
left join auth.users u on u.id = s.submitted_by
group by s.submitted_by, u.email
order by last_submission desc;

-- 3a. Number of submissions per status.
select coalesce(verification_status, '(empty)') as status, count(*) as submissions
from public.product_submissions
group by verification_status
order by status;

-- 3b. Pending submissions (oldest first).
select id, submitted_by, barcode, product_name, brand_name, created_at
from public.product_submissions
where verification_status = 'pending'
order by created_at;

-- 3c. Approved submissions.
select id, submitted_by, barcode, product_name, brand_name, reviewed_by, reviewed_at
from public.product_submissions
where verification_status = 'approved'
order by reviewed_at desc nulls last;

-- 3d. Rejected submissions.
select id, submitted_by, barcode, product_name, brand_name, reviewed_by, reviewed_at, review_notes
from public.product_submissions
where verification_status = 'rejected'
order by reviewed_at desc nulls last;

-- 4. Submissions from users whose sharing is NOW off (or who have no
--    preferences row). There is no "consent at the time" column, so this
--    compares with the CURRENT setting: a row here means either the user
--    turned sharing off later, or it was submitted before the database
--    consent check (user_database_consent_rls.sql) existed.
select s.id,
       s.submitted_by,
       u.email,
       s.barcode,
       s.product_name,
       s.verification_status,
       s.created_at,
       p.submit_products_for_review as sharing_enabled_now,
       p.updated_at as preferences_updated_at,
       case
         when p.user_id is null then 'no preferences row'
         when p.updated_at > s.created_at then 'sharing turned off after this submission'
         else 'submitted while sharing was off (before the database check)'
       end as explanation
from public.product_submissions s
left join public.user_preferences p on p.user_id = s.submitted_by
left join auth.users u on u.id = s.submitted_by
where coalesce(p.submit_products_for_review, false) = false
order by s.created_at desc;

-- 5. Users with sharing ON who have not submitted anything yet.
select p.user_id, u.email, p.updated_at
from public.user_preferences p
left join auth.users u on u.id = p.user_id
where p.submit_products_for_review = true
  and not exists (
    select 1 from public.product_submissions s where s.submitted_by = p.user_id
  )
order by p.updated_at desc nulls last;
