-- My Pockets — Passkey (WebAuthn) credential storage.
-- Registration happens over a normal authenticated session (RLS-checked).
-- Authentication (login) necessarily happens *before* a session exists, so
-- the lookup-by-credential-id step in app/api/webauthn/auth-verify uses the
-- service-role client from a trusted server route, not a client-side query.

create table webauthn_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  credential_id text not null unique,
  public_key text not null, -- base64url-encoded COSE public key
  counter bigint not null default 0,
  device_type text,
  backed_up boolean not null default false,
  transports text[],
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index webauthn_credentials_user_id_idx on webauthn_credentials (user_id);

alter table webauthn_credentials enable row level security;

create policy webauthn_credentials_select on webauthn_credentials for select
  using (user_id = auth.uid());

create policy webauthn_credentials_insert on webauthn_credentials for insert
  with check (user_id = auth.uid());

create policy webauthn_credentials_delete on webauthn_credentials for delete
  using (user_id = auth.uid());
