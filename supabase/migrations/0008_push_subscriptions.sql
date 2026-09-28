-- Web Push subscriptions — one row per (profile, browser/device). A family
-- admin can have several devices; each independently receives
-- withdrawal-request notifications. Sending itself always goes through the
-- service-role client (app/api/push/notify-withdrawal-request), so RLS here
-- only needs to govern the self-service subscribe/unsubscribe calls a
-- profile makes on its own behalf.
create table push_subscriptions (
  endpoint text primary key,
  profile_id uuid not null references profiles (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index push_subscriptions_profile_id_idx on push_subscriptions (profile_id);

alter table push_subscriptions enable row level security;

create policy push_subscriptions_select on push_subscriptions for select
  using (profile_id = auth.uid());

create policy push_subscriptions_insert on push_subscriptions for insert
  with check (profile_id = auth.uid());

-- Upsert-by-endpoint (a re-subscribe reuses the same endpoint with fresh
-- keys) needs UPDATE too, not just INSERT.
create policy push_subscriptions_update on push_subscriptions for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create policy push_subscriptions_delete on push_subscriptions for delete
  using (profile_id = auth.uid());
