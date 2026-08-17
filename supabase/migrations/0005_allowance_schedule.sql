-- Adds explicit payment-day scheduling to allowances: a specific weekday
-- for 'weekly' configs, or a specific day-of-month (1-28) / "last day of
-- month" for 'monthly' configs. Also fixes a pre-existing bug in
-- process_due_allowances() where `next_run_date + interval '1 month'`
-- overflows short months (e.g. Jan 31 -> Mar 3) instead of landing back
-- on the intended day.

alter table allowance_configs
  add column if not exists weekly_weekday smallint check (weekly_weekday between 0 and 6),
  add column if not exists monthly_day smallint check (monthly_day between 1 and 28),
  add column if not exists monthly_last_day boolean not null default false;

-- Backfill existing rows (created before this migration, so their new
-- schedule columns came in NULL) from whatever next_run_date they already
-- have, so the check constraint below doesn't reject pre-existing data.
-- Day-of-month 29-31 has no direct 1-28 slot, so it's treated as "last day".
update allowance_configs
set weekly_weekday = extract(dow from next_run_date)::smallint
where frequency = 'weekly' and weekly_weekday is null;

update allowance_configs
set monthly_last_day = true
where frequency = 'monthly' and monthly_day is null and not monthly_last_day
  and extract(day from next_run_date) > 28;

update allowance_configs
set monthly_day = extract(day from next_run_date)::smallint
where frequency = 'monthly' and monthly_day is null and not monthly_last_day
  and extract(day from next_run_date) <= 28;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'allowance_configs_schedule_chk'
  ) then
    alter table allowance_configs
      add constraint allowance_configs_schedule_chk check (
        (frequency = 'weekly' and weekly_weekday is not null
           and monthly_day is null and monthly_last_day = false)
        or (frequency = 'monthly' and weekly_weekday is null and (
              (monthly_last_day = true and monthly_day is null)
              or (monthly_last_day = false and monthly_day between 1 and 28)
            ))
        or (frequency = 'custom_days')
      );
  end if;
end $$;

create or replace function process_due_allowances()
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_config record;
  v_family_id uuid;
  v_next date;
  v_next_month_start date;
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
