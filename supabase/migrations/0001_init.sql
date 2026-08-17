-- My Pockets — initial schema
-- Tables only. RLS in 0002_rls.sql, functions/RPCs in 0003_functions.sql.

create extension if not exists "pgcrypto";

-- ─── Enums ──────────────────────────────────────────────────────────────

create type profile_role as enum ('super_admin', 'family_admin', 'child');
create type admin_status as enum ('pending', 'active', 'rejected');
create type pocket_type as enum ('spend', 'savings', 'investments');
create type transaction_type as enum (
  'deposit',
  'withdrawal',
  'allowance',
  'savings_bonus',
  'market_adjustment',
  'admin_adjustment'
);
create type transaction_status as enum ('pending', 'completed', 'rejected');
create type allowance_frequency as enum ('weekly', 'monthly', 'custom_days');
create type bonus_run_status as enum ('applied', 'undone');
create type investment_mode as enum ('manual', 'auto');
create type rate_source as enum ('manual', 'auto');

-- ─── Families & people ─────────────────────────────────────────────────

create table families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id)
);

-- One row per authenticated identity (admin or child). Mirrors auth.users.
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  family_id uuid references families (id) on delete cascade,
  role profile_role not null,
  display_name text not null,
  -- Only set (and unique) for children; admins sign in with real email.
  username text,
  locale_pref text default 'en',
  created_at timestamptz not null default now(),
  constraint profiles_username_unique unique (username)
);

create index profiles_family_id_idx on profiles (family_id);

-- Join table: which admins manage which family, and their approval status.
-- A family can have multiple admins (e.g. both parents); every admin must
-- be individually approved by a super_admin before they can act.
create table family_admins (
  family_id uuid not null references families (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  status admin_status not null default 'pending',
  approved_by uuid references profiles (id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (family_id, user_id)
);

create index family_admins_user_id_idx on family_admins (user_id);

-- ─── Pockets & the ledger ──────────────────────────────────────────────

create table pockets (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references profiles (id) on delete cascade,
  type pocket_type not null,
  balance numeric(12, 2) not null default 0 check (balance >= 0),
  created_at timestamptz not null default now(),
  unique (child_id, type)
);

-- Unified activity log. Ledger rule: `pockets.balance` only ever changes by
-- exactly `amount` at the moment a transaction's status becomes
-- 'completed' (see 0003_functions.sql). `amount` is *signed* — positive
-- grows the pocket (deposit, allowance, savings bonus, market gain),
-- negative shrinks it (withdrawal, market loss). A 'pending' withdrawal
-- request is therefore just a hold, computed on the fly by summing pending
-- negative amounts — never written back to `balance` until approved.
create table transactions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (id) on delete cascade,
  child_id uuid not null references profiles (id) on delete cascade,
  pocket_type pocket_type not null,
  type transaction_type not null,
  amount numeric(12, 2) not null check (amount <> 0),
  status transaction_status not null default 'completed',
  description text,
  savings_bonus_run_id uuid,
  created_by uuid not null references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index transactions_family_id_idx on transactions (family_id);
create index transactions_child_id_idx on transactions (child_id, created_at desc);
create index transactions_pending_idx on transactions (child_id, pocket_type)
  where status = 'pending';

-- ─── Allowances ────────────────────────────────────────────────────────

create table allowance_configs (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references profiles (id) on delete cascade,
  spend_amount numeric(12, 2) not null check (spend_amount >= 1),
  savings_amount numeric(12, 2) not null check (savings_amount >= 1),
  investments_amount numeric(12, 2) not null check (investments_amount >= 1),
  frequency allowance_frequency not null,
  -- only used when frequency = 'custom_days'
  interval_days int check (interval_days > 0),
  next_run_date date not null,
  active boolean not null default true,
  created_by uuid not null references profiles (id),
  updated_at timestamptz not null default now()
);

create index allowance_configs_due_idx on allowance_configs (next_run_date)
  where active = true;

-- ─── Savings bonus (last day of month, family-wide) ───────────────────

create table savings_bonus_runs (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (id) on delete cascade,
  run_date date not null,
  -- first-of-month bucket for run_date, so "undo + recalculate" or a retry
  -- can't accidentally double-apply the bonus within the same month
  run_month date generated always as (
    make_date(extract(year from run_date)::int, extract(month from run_date)::int, 1)
  ) stored,
  status bonus_run_status not null default 'applied',
  created_by uuid references profiles (id), -- null when triggered by cron
  undone_at timestamptz,
  created_at timestamptz not null default now()
);

-- Partial (not plain) unique: an 'undone' run must free up its month so
-- recalculate_savings_bonus() (undo, then re-run) can insert a fresh row
-- for the same family_id/run_month.
create unique index savings_bonus_runs_active_month_idx
  on savings_bonus_runs (family_id, run_month)
  where status = 'applied';

alter table transactions
  add constraint transactions_bonus_run_fk
  foreign key (savings_bonus_run_id) references savings_bonus_runs (id);

-- ─── Investments ───────────────────────────────────────────────────────

create table market_benchmarks (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  api_symbol text not null,
  last_rate_pct numeric(6, 3),
  last_fetched_at timestamptz
);

create table family_investment_settings (
  family_id uuid primary key references families (id) on delete cascade,
  mode investment_mode not null default 'manual',
  benchmark_id uuid references market_benchmarks (id),
  updated_at timestamptz not null default now()
);

create table investment_rate_history (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (id) on delete cascade,
  rate_pct numeric(6, 3) not null,
  source rate_source not null,
  applied_at timestamptz not null default now(),
  applied_by uuid references profiles (id) -- null when applied by cron
);

create index investment_rate_history_family_idx
  on investment_rate_history (family_id, applied_at desc);
