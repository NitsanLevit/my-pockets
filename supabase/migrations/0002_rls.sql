-- My Pockets — RLS
--
-- Pattern: every "does the caller have rights to X" check is a
-- SECURITY DEFINER helper function. Because these functions are created by
-- the migration-running role (postgres), which owns the tables, they read
-- `profiles`/`family_admins` WITHOUT re-triggering RLS on those tables —
-- this is what avoids infinite policy recursion.
--
-- Almost nothing here grants direct INSERT/UPDATE for money-moving columns.
-- Balance-affecting writes only happen inside the SECURITY DEFINER RPCs in
-- 0003_functions.sql, which perform their own authorization checks. RLS
-- below mostly governs SELECT (family-scoped visibility) plus a couple of
-- narrow, column-restricted UPDATEs (profile display name, transaction
-- description) that are safe for direct client writes.

-- ─── Helper functions ──────────────────────────────────────────────────

create function current_profile_role()
returns profile_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

create function current_profile_family_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select family_id from profiles where id = auth.uid();
$$;

create function is_super_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select current_profile_role() = 'super_admin';
$$;

create function is_active_family_admin(target_family uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from family_admins
    where family_id = target_family
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

create function family_id_of(target_profile uuid)
returns uuid
language sql stable security definer set search_path = public as $$
  select family_id from profiles where id = target_profile;
$$;

create function is_active_family_admin_of(target_profile uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select is_active_family_admin(family_id_of(target_profile));
$$;

-- Used by the child-login screen before a session exists: resolves the
-- synthetic email behind a username so the client can call
-- signInWithPassword. Returns null silently for unknown usernames.
create function resolve_child_email(p_username text)
returns text
language sql stable security definer set search_path = public as $$
  select au.email
  from auth.users au
  join profiles p on p.id = au.id
  where p.username = p_username and p.role = 'child';
$$;

grant execute on function resolve_child_email(text) to anon, authenticated;

-- ─── Enable RLS ─────────────────────────────────────────────────────────

alter table families enable row level security;
alter table profiles enable row level security;
alter table family_admins enable row level security;
alter table pockets enable row level security;
alter table transactions enable row level security;
alter table allowance_configs enable row level security;
alter table savings_bonus_runs enable row level security;
alter table market_benchmarks enable row level security;
alter table family_investment_settings enable row level security;
alter table investment_rate_history enable row level security;

-- ─── families ───────────────────────────────────────────────────────────

create policy families_select on families for select
  using (
    is_super_admin()
    or is_active_family_admin(id)
    or id = current_profile_family_id()
  );

create policy families_update on families for update
  using (is_active_family_admin(id) or is_super_admin())
  with check (is_active_family_admin(id) or is_super_admin());

grant update (name) on families to authenticated;

-- ─── profiles ───────────────────────────────────────────────────────────

create policy profiles_select on profiles for select
  using (
    id = auth.uid()
    or is_super_admin()
    or is_active_family_admin(family_id)
  );

create policy profiles_update on profiles for update
  using (id = auth.uid() or is_active_family_admin(family_id) or is_super_admin())
  with check (id = auth.uid() or is_active_family_admin(family_id) or is_super_admin());

grant update (display_name, locale_pref) on profiles to authenticated;

-- ─── family_admins ──────────────────────────────────────────────────────

create policy family_admins_select on family_admins for select
  using (
    user_id = auth.uid()
    or is_super_admin()
    or is_active_family_admin(family_id)
  );

-- Only a super_admin can flip pending -> active/rejected.
create policy family_admins_update on family_admins for update
  using (is_super_admin())
  with check (is_super_admin());

grant update (status, approved_by, approved_at) on family_admins to authenticated;

-- ─── pockets ────────────────────────────────────────────────────────────

create policy pockets_select on pockets for select
  using (
    child_id = auth.uid()
    or is_active_family_admin_of(child_id)
    or is_super_admin()
  );

-- No direct INSERT/UPDATE policy: balances only change via RPCs.

-- ─── transactions ───────────────────────────────────────────────────────

create policy transactions_select on transactions for select
  using (
    child_id = auth.uid()
    or is_active_family_admin_of(child_id)
    or is_super_admin()
  );

-- Admin and child can both edit/add a description, nothing else.
create policy transactions_update_description on transactions for update
  using (
    child_id = auth.uid()
    or is_active_family_admin_of(child_id)
    or is_super_admin()
  )
  with check (
    child_id = auth.uid()
    or is_active_family_admin_of(child_id)
    or is_super_admin()
  );

grant update (description) on transactions to authenticated;

-- Row creation (deposits, withdrawals, requests, bonuses, market updates)
-- only happens via RPCs — no direct INSERT policy.

-- ─── allowance_configs ────────────────────────────────────────────────

create policy allowance_configs_select on allowance_configs for select
  using (
    child_id = auth.uid()
    or is_active_family_admin_of(child_id)
    or is_super_admin()
  );

create policy allowance_configs_insert on allowance_configs for insert
  with check (is_active_family_admin_of(child_id));

create policy allowance_configs_update on allowance_configs for update
  using (is_active_family_admin_of(child_id))
  with check (is_active_family_admin_of(child_id));

create policy allowance_configs_delete on allowance_configs for delete
  using (is_active_family_admin_of(child_id));

-- ─── savings_bonus_runs ─────────────────────────────────────────────────

create policy savings_bonus_runs_select on savings_bonus_runs for select
  using (
    is_active_family_admin(family_id)
    or is_super_admin()
    or family_id = current_profile_family_id()
  );

-- Mutations only via run_savings_bonus / undo_savings_bonus RPCs.

-- ─── market_benchmarks (public reference data) ─────────────────────────

create policy market_benchmarks_select on market_benchmarks for select
  using (true);

-- Writes only via service-role (seed data + the daily rate-fetch cron).

-- ─── family_investment_settings ─────────────────────────────────────────

create policy family_investment_settings_select on family_investment_settings
  for select using (
    is_active_family_admin(family_id)
    or is_super_admin()
    or family_id = current_profile_family_id()
  );

create policy family_investment_settings_insert on family_investment_settings
  for insert with check (is_active_family_admin(family_id));

create policy family_investment_settings_update on family_investment_settings
  for update
  using (is_active_family_admin(family_id))
  with check (is_active_family_admin(family_id));

-- ─── investment_rate_history ─────────────────────────────────────────────

create policy investment_rate_history_select on investment_rate_history
  for select using (
    is_active_family_admin(family_id)
    or is_super_admin()
    or family_id = current_profile_family_id()
  );

-- Rows only inserted via the apply_market_rate RPC.
