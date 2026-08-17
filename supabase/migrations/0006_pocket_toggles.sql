-- Lets a family admin turn individual pockets off/on per child (e.g. a
-- family that doesn't want to introduce Investments yet). Disabled pockets
-- keep their balance (nothing is deleted or zeroed) but stop appearing in
-- the UI and stop being credited by the daily crons; re-enabling resumes
-- crediting from wherever the balance was left.

alter table pockets add column enabled boolean not null default true;

-- Toggling is not a balance change, so (like transactions_update_description)
-- it's a narrow, column-restricted RLS policy rather than a new RPC.
create policy pockets_update_enabled on pockets for update
  using (is_active_family_admin_of(child_id))
  with check (is_active_family_admin_of(child_id));

grant update (enabled) on pockets to authenticated;

-- ─── Guard the money-moving RPCs against disabled pockets ────────────────

create or replace function admin_adjust_balance(
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

  if not coalesce(
    (select enabled from pockets where child_id = p_child_id and type = p_pocket_type), false
  ) then
    raise exception 'This pocket is not enabled for this child';
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

create or replace function request_withdrawal(p_amount numeric, p_description text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_child_id uuid := auth.uid();
  v_family_id uuid;
  v_balance numeric;
  v_enabled boolean;
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

  select balance, enabled into v_balance, v_enabled from pockets where child_id = v_child_id and type = 'spend';
  if not coalesce(v_enabled, false) then
    raise exception 'Spend pocket is not enabled for this child';
  end if;

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

create or replace function run_savings_bonus(p_family_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_caller_is_admin boolean := is_active_family_admin(p_family_id);
  v_run_id uuid;
  v_child record;
  v_bonus numeric;
begin
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
    where p.family_id = p_family_id and p.role = 'child' and pk.balance > 0 and pk.enabled
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

create or replace function apply_market_rate(p_family_id uuid, p_rate_pct numeric, p_source rate_source)
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
    where p.family_id = p_family_id and p.role = 'child' and pk.balance > 0 and pk.enabled
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

create or replace function process_due_allowances()
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_config record;
  v_family_id uuid;
  v_next date;
  v_next_month_start date;
  v_spend_enabled boolean;
  v_savings_enabled boolean;
  v_investments_enabled boolean;
  v_count int := 0;
begin
  if auth.uid() is not null then
    raise exception 'Allowance processing is cron-only';
  end if;

  for v_config in
    select * from allowance_configs where active = true and next_run_date <= current_date
  loop
    v_family_id := family_id_of(v_config.child_id);

    select enabled into v_spend_enabled from pockets where child_id = v_config.child_id and type = 'spend';
    select enabled into v_savings_enabled from pockets where child_id = v_config.child_id and type = 'savings';
    select enabled into v_investments_enabled from pockets where child_id = v_config.child_id and type = 'investments';

    if coalesce(v_spend_enabled, false) then
      insert into transactions (family_id, child_id, pocket_type, type, amount, status, description, created_by)
      values (v_family_id, v_config.child_id, 'spend', 'allowance', v_config.spend_amount, 'completed', 'Allowance', v_config.child_id);
      update pockets set balance = balance + v_config.spend_amount where child_id = v_config.child_id and type = 'spend';
    end if;

    if coalesce(v_savings_enabled, false) then
      insert into transactions (family_id, child_id, pocket_type, type, amount, status, description, created_by)
      values (v_family_id, v_config.child_id, 'savings', 'allowance', v_config.savings_amount, 'completed', 'Allowance', v_config.child_id);
      update pockets set balance = balance + v_config.savings_amount where child_id = v_config.child_id and type = 'savings';
    end if;

    if coalesce(v_investments_enabled, false) then
      insert into transactions (family_id, child_id, pocket_type, type, amount, status, description, created_by)
      values (v_family_id, v_config.child_id, 'investments', 'allowance', v_config.investments_amount, 'completed', 'Allowance', v_config.child_id);
      update pockets set balance = balance + v_config.investments_amount where child_id = v_config.child_id and type = 'investments';
    end if;

    if v_config.frequency = 'weekly' then
      v_next := v_config.next_run_date + 7;
    elsif v_config.frequency = 'monthly' then
      v_next_month_start := (date_trunc('month', v_config.next_run_date) + interval '1 month')::date;
      if v_config.monthly_last_day then
        v_next := (v_next_month_start + interval '1 month' - interval '1 day')::date;
      else
        v_next := v_next_month_start + (v_config.monthly_day - 1);
      end if;
    else
      v_next := v_config.next_run_date + make_interval(days => v_config.interval_days);
    end if;

    update allowance_configs set next_run_date = v_next, updated_at = now() where id = v_config.id;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;
