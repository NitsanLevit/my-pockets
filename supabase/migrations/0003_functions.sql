-- My Pockets — RPCs
--
-- Ledger rule used throughout: a transaction's signed `amount` is applied
-- to `pockets.balance` exactly once, at the moment status becomes
-- 'completed'. Positive grows the pocket, negative shrinks it. Everything
-- that moves money is a SECURITY DEFINER function so the balance update
-- and the log entry always happen atomically in one transaction.

-- ─── Signup ──────────────────────────────────────────────────────────────

-- Called once, right after supabase.auth.signUp() on the client, while
-- authenticated as the brand-new user. Creates the family (pending, until
-- a super_admin approves) and the admin's own profile.
create function complete_family_admin_signup(p_family_name text, p_display_name text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_family_id uuid;
begin
  if exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'Profile already exists for this user';
  end if;

  insert into families (name, created_by)
  values (p_family_name, auth.uid())
  returning id into v_family_id;

  insert into profiles (id, family_id, role, display_name)
  values (auth.uid(), v_family_id, 'family_admin', p_display_name);

  insert into family_admins (family_id, user_id, status)
  values (v_family_id, auth.uid(), 'pending');

  return v_family_id;
end;
$$;

grant execute on function complete_family_admin_signup(text, text) to authenticated;

-- Approve or reject a pending family_admin. super_admin only (enforced by
-- the family_admins RLS UPDATE policy the function runs under — this RPC
-- is SECURITY INVOKER on purpose, so it inherits the caller's RLS).
create function set_family_admin_status(p_family_id uuid, p_user_id uuid, p_status admin_status)
returns void
language plpgsql security invoker set search_path = public as $$
begin
  update family_admins
  set status = p_status,
      approved_by = auth.uid(),
      approved_at = now()
  where family_id = p_family_id and user_id = p_user_id;

  if not found then
    raise exception 'No matching family_admins row (or not authorized)';
  end if;
end;
$$;

grant execute on function set_family_admin_status(uuid, uuid, admin_status) to authenticated;

-- ─── Child accounts ──────────────────────────────────────────────────────

-- The auth.users row for a child is created separately (Admin API, needs
-- the service-role key — see app/api/admin/children/route.ts). This RPC
-- finishes the setup once that auth user exists: profile + 3 zero-balance
-- pockets. Runs as the *admin* (authenticated), not as the child.
create function provision_child(
  p_child_auth_id uuid,
  p_family_id uuid,
  p_display_name text,
  p_username text
)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_active_family_admin(p_family_id) then
    raise exception 'Not an active admin of this family';
  end if;

  insert into profiles (id, family_id, role, display_name, username)
  values (p_child_auth_id, p_family_id, 'child', p_display_name, p_username);

  insert into pockets (child_id, type)
  values
    (p_child_auth_id, 'spend'),
    (p_child_auth_id, 'savings'),
    (p_child_auth_id, 'investments');
end;
$$;

grant execute on function provision_child(uuid, uuid, text, text) to authenticated;

-- ─── Withdrawals ─────────────────────────────────────────────────────────

-- Child submits a request against their own Spend pocket. Reserve-on-request:
-- we don't touch `balance`, but the pending row itself is the hold — see
-- the `available_balance` computation used by the UI (any SELECT summing
-- pending amounts works; no separate column to keep in sync).
create function request_withdrawal(p_amount numeric, p_description text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_child_id uuid := auth.uid();
  v_family_id uuid;
  v_balance numeric;
  v_pending numeric;
  v_txn_id uuid;
begin
  if p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;

  select family_id into v_family_id from profiles where id = v_child_id and role = 'child';
  if v_family_id is null then
    raise exception 'Only a child account can request a withdrawal';
  end if;

  select balance into v_balance from pockets where child_id = v_child_id and type = 'spend';

  select coalesce(sum(-amount), 0) into v_pending
  from transactions
  where child_id = v_child_id and pocket_type = 'spend' and type = 'withdrawal' and status = 'pending';

  if p_amount > (v_balance - v_pending) then
    raise exception 'Amount exceeds available balance';
  end if;

  insert into transactions (family_id, child_id, pocket_type, type, amount, status, description, created_by)
  values (v_family_id, v_child_id, 'spend', 'withdrawal', -p_amount, 'pending', p_description, v_child_id)
  returning id into v_txn_id;

  return v_txn_id;
end;
$$;

grant execute on function request_withdrawal(numeric, text) to authenticated;

create function approve_withdrawal(p_transaction_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_txn transactions%rowtype;
begin
  select * into v_txn from transactions where id = p_transaction_id for update;

  if v_txn is null or v_txn.type <> 'withdrawal' or v_txn.status <> 'pending' then
    raise exception 'No pending withdrawal with that id';
  end if;
  if not is_active_family_admin_of(v_txn.child_id) then
    raise exception 'Not an active admin of this child''s family';
  end if;

  update transactions set status = 'completed', updated_at = now() where id = p_transaction_id;
  update pockets set balance = balance + v_txn.amount
    where child_id = v_txn.child_id and type = v_txn.pocket_type;
end;
$$;

grant execute on function approve_withdrawal(uuid) to authenticated;

create function reject_withdrawal(p_transaction_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_txn transactions%rowtype;
begin
  select * into v_txn from transactions where id = p_transaction_id for update;

  if v_txn is null or v_txn.type <> 'withdrawal' or v_txn.status <> 'pending' then
    raise exception 'No pending withdrawal with that id';
  end if;
  if not is_active_family_admin_of(v_txn.child_id) then
    raise exception 'Not an active admin of this child''s family';
  end if;

  -- Balance was never touched for a pending request, so rejecting is just
  -- a status flip — nothing to reverse.
  update transactions set status = 'rejected', updated_at = now() where id = p_transaction_id;
end;
$$;

grant execute on function reject_withdrawal(uuid) to authenticated;

-- Direct admin deposit/withdrawal into any of a child's 3 pockets.
create function admin_adjust_balance(
  p_child_id uuid,
  p_pocket_type pocket_type,
  p_amount numeric,
  p_direction text, -- 'deposit' | 'withdrawal'
  p_description text
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_family_id uuid;
  v_signed numeric;
  v_txn_id uuid;
begin
  if p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;
  if p_direction not in ('deposit', 'withdrawal') then
    raise exception 'Invalid direction';
  end if;

  v_family_id := family_id_of(p_child_id);
  if not is_active_family_admin(v_family_id) then
    raise exception 'Not an active admin of this child''s family';
  end if;

  v_signed := case when p_direction = 'deposit' then p_amount else -p_amount end;

  if p_direction = 'withdrawal' then
    if v_signed + (select balance from pockets where child_id = p_child_id and type = p_pocket_type) < 0 then
      raise exception 'Amount exceeds pocket balance';
    end if;
  end if;

  insert into transactions (family_id, child_id, pocket_type, type, amount, status, description, created_by)
  values (v_family_id, p_child_id, p_pocket_type, p_direction::transaction_type, v_signed, 'completed', p_description, auth.uid())
  returning id into v_txn_id;

  update pockets set balance = balance + v_signed where child_id = p_child_id and type = p_pocket_type;

  return v_txn_id;
end;
$$;

grant execute on function admin_adjust_balance(uuid, pocket_type, numeric, text, text) to authenticated;

-- ─── Savings bonus (10%, last day of the month, whole family) ───────────

create function run_savings_bonus(p_family_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_caller_is_admin boolean := is_active_family_admin(p_family_id);
  v_run_id uuid;
  v_child record;
  v_bonus numeric;
begin
  -- Callable by an active admin (manual button) or by the service role
  -- (daily cron, which has no auth.uid() and therefore bypasses RLS
  -- entirely — this check just also allows that case explicitly).
  if not (v_caller_is_admin or auth.uid() is null) then
    raise exception 'Not an active admin of this family';
  end if;

  insert into savings_bonus_runs (family_id, run_date, created_by)
  values (p_family_id, current_date, case when v_caller_is_admin then auth.uid() else null end)
  returning id into v_run_id;

  for v_child in
    select p.id as child_id, pk.balance
    from profiles p
    join pockets pk on pk.child_id = p.id and pk.type = 'savings'
    where p.family_id = p_family_id and p.role = 'child' and pk.balance > 0
  loop
    v_bonus := round(v_child.balance * 0.10, 2);

    insert into transactions (
      family_id, child_id, pocket_type, type, amount, status, description,
      savings_bonus_run_id, created_by
    ) values (
      p_family_id, v_child.child_id, 'savings', 'savings_bonus', v_bonus, 'completed',
      '10% monthly savings bonus', v_run_id, coalesce(auth.uid(), v_child.child_id)
    );

    update pockets set balance = balance + v_bonus
      where child_id = v_child.child_id and type = 'savings';
  end loop;

  return v_run_id;
end;
$$;

grant execute on function run_savings_bonus(uuid) to authenticated, service_role;

create function undo_savings_bonus(p_run_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_run savings_bonus_runs%rowtype;
  v_txn record;
begin
  select * into v_run from savings_bonus_runs where id = p_run_id for update;
  if v_run is null or v_run.status <> 'applied' then
    raise exception 'No applied bonus run with that id';
  end if;
  if not is_active_family_admin(v_run.family_id) then
    raise exception 'Not an active admin of this family';
  end if;

  for v_txn in
    select * from transactions
    where savings_bonus_run_id = p_run_id and type = 'savings_bonus' and status = 'completed'
  loop
    insert into transactions (
      family_id, child_id, pocket_type, type, amount, status, description,
      savings_bonus_run_id, created_by
    ) values (
      v_txn.family_id, v_txn.child_id, 'savings', 'savings_bonus', -v_txn.amount, 'completed',
      'Reversal of ' || to_char(v_run.run_date, 'YYYY-MM') || ' savings bonus', p_run_id, auth.uid()
    );

    update pockets set balance = balance - v_txn.amount
      where child_id = v_txn.child_id and type = 'savings';
  end loop;

  update savings_bonus_runs set status = 'undone', undone_at = now() where id = p_run_id;
end;
$$;

grant execute on function undo_savings_bonus(uuid) to authenticated;

-- Convenience: undo the given run, then immediately re-run the bonus off
-- the (now corrected) balances — for the "retroactive adjustment" case.
create function recalculate_savings_bonus(p_run_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_family_id uuid;
  v_new_run_id uuid;
begin
  select family_id into v_family_id from savings_bonus_runs where id = p_run_id;
  perform undo_savings_bonus(p_run_id);
  v_new_run_id := run_savings_bonus(v_family_id);
  return v_new_run_id;
end;
$$;

grant execute on function recalculate_savings_bonus(uuid) to authenticated;

-- ─── Investments ─────────────────────────────────────────────────────────

-- source = 'manual': caller must be an active admin of the family.
-- source = 'auto': only callable by the service role (daily cron route),
-- which has no auth.uid() — enforced below.
create function apply_market_rate(p_family_id uuid, p_rate_pct numeric, p_source rate_source)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_history_id uuid;
  v_child record;
  v_delta numeric;
begin
  if p_source = 'manual' and not is_active_family_admin(p_family_id) then
    raise exception 'Not an active admin of this family';
  end if;
  if p_source = 'auto' and auth.uid() is not null then
    raise exception 'Auto rate updates are cron-only';
  end if;

  insert into investment_rate_history (family_id, rate_pct, source, applied_by)
  values (p_family_id, p_rate_pct, p_source, auth.uid())
  returning id into v_history_id;

  for v_child in
    select p.id as child_id, pk.balance
    from profiles p
    join pockets pk on pk.child_id = p.id and pk.type = 'investments'
    where p.family_id = p_family_id and p.role = 'child' and pk.balance > 0
  loop
    v_delta := round(v_child.balance * (p_rate_pct / 100.0), 2);
    if v_delta <> 0 then
      insert into transactions (family_id, child_id, pocket_type, type, amount, status, description, created_by)
      values (
        p_family_id, v_child.child_id, 'investments', 'market_adjustment', v_delta, 'completed',
        format('Market update: %s%%', p_rate_pct), coalesce(auth.uid(), v_child.child_id)
      );

      update pockets set balance = balance + v_delta
        where child_id = v_child.child_id and type = 'investments';
    end if;
  end loop;

  return v_history_id;
end;
$$;

grant execute on function apply_market_rate(uuid, numeric, rate_source) to authenticated, service_role;

-- ─── Allowances (daily cron, service-role only) ─────────────────────────

create function process_due_allowances()
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_config record;
  v_family_id uuid;
  v_next date;
  v_count int := 0;
begin
  if auth.uid() is not null then
    raise exception 'Allowance processing is cron-only';
  end if;

  for v_config in
    select * from allowance_configs where active = true and next_run_date <= current_date
  loop
    v_family_id := family_id_of(v_config.child_id);

    insert into transactions (family_id, child_id, pocket_type, type, amount, status, description, created_by)
    values
      (v_family_id, v_config.child_id, 'spend', 'allowance', v_config.spend_amount, 'completed', 'Allowance', v_config.child_id),
      (v_family_id, v_config.child_id, 'savings', 'allowance', v_config.savings_amount, 'completed', 'Allowance', v_config.child_id),
      (v_family_id, v_config.child_id, 'investments', 'allowance', v_config.investments_amount, 'completed', 'Allowance', v_config.child_id);

    update pockets set balance = balance + v_config.spend_amount where child_id = v_config.child_id and type = 'spend';
    update pockets set balance = balance + v_config.savings_amount where child_id = v_config.child_id and type = 'savings';
    update pockets set balance = balance + v_config.investments_amount where child_id = v_config.child_id and type = 'investments';

    v_next := case v_config.frequency
      when 'weekly' then v_config.next_run_date + interval '7 days'
      when 'monthly' then v_config.next_run_date + interval '1 month'
      when 'custom_days' then v_config.next_run_date + make_interval(days => v_config.interval_days)
    end;

    update allowance_configs set next_run_date = v_next, updated_at = now() where id = v_config.id;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function process_due_allowances() to service_role;

-- ─── Savings bonus (daily cron checks "is it month-end?", service-role) ─

create function run_savings_bonus_for_all_families_if_month_end()
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_family record;
  v_count int := 0;
begin
  if auth.uid() is not null then
    raise exception 'Cron-only';
  end if;
  if current_date <> (date_trunc('month', current_date) + interval '1 month' - interval '1 day')::date then
    return 0;
  end if;

  for v_family in select id from families loop
    perform run_savings_bonus(v_family.id);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function run_savings_bonus_for_all_families_if_month_end() to service_role;
