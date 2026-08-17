-- Run after the migrations. Safe to re-run (idempotent upserts).

insert into market_benchmarks (name, api_symbol) values
  ('S&P 500', 'SPY'),
  ('NASDAQ 100', 'QQQ'),
  ('TA-125', 'TA125.TA')
on conflict (name) do nothing;

-- ─── Bootstrapping the first Super Admin ─────────────────────────────────
--
-- There's no signup flow for super_admin — by design, only an existing
-- super_admin can create more of them, and the very first one doesn't
-- exist yet. So:
--
--   1. Sign up as a normal Family Admin through the app (/signup).
--   2. Find that user's id:
--        select id, email from auth.users where email = 'you@example.com';
--   3. Promote them (run in the Supabase SQL editor, as the postgres role,
--      which bypasses RLS):
--
--        update profiles set role = 'super_admin', family_id = null
--        where id = '<uuid-from-step-2>';
--
--        delete from family_admins where user_id = '<uuid-from-step-2>';
--
--   The family they created in step 1 stays orphaned unless you also
--   delete/reassign it — most people just do this with a throwaway email.
