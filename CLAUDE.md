@AGENTS.md

# My Pockets

A financial-education web app. Kids track virtual money across three
**pockets** (Spend, Savings, Investments); parents ("Family Admins") act as
the offline bank — the money is real, held by the parents, and this app is
the ledger + simulation layer on top of it.

## Roles

- **Super Admin** — approves new Family Admin signups (pending → active).
  Bootstrapped manually via SQL (see `supabase/seed.sql`) — there's no
  signup flow for this role.
- **Family Admin (parent)** — manages one family: adds kids, configures
  allowances, approves withdrawal requests, sets the investment rate.
  Email/password or magic link via Supabase Auth. A family can have
  multiple admins (e.g. both parents), each individually approved.
- **Child** — view-only on their own balances, can request withdrawals from
  Spend. Logs in with a **username** (not email) + password, then is
  prompted to set up a **Passkey** (Face ID / Touch ID / Windows Hello) for
  next time.

## The 3 pockets

1. **Spend** — everyday available money.
2. **Savings** — grows 10% automatically on the **last day of every month**
   (whatever the balance is at that moment), family-wide. Not per-deposit.
3. **Investments** — simulates a portfolio. Family Admin sets a rate either
   manually or by subscribing to a real benchmark (S&P 500 / NASDAQ /
   TA-125), refreshed once a day by a Vercel Cron job.

## Architecture

- **Next.js 16** (App Router, Turbopack by default), React 19, Tailwind v4,
  TypeScript.
- **Supabase**: Postgres + Auth + RLS. See `supabase/migrations/` — run in
  order (`0001_init` → `0002_rls` → `0003_functions` → `0004_webauthn`),
  then `supabase/seed.sql`.
- **next-intl**: `en` (default, LTR) and `he` (RTL), toggle in the header.
  Routes live under `app/[locale]/...`.
- **`@simplewebauthn/server` + `/browser`**: Passkeys. Registration happens
  over a normal session; login (`app/api/webauthn/auth-*`) happens before
  one exists, so it looks up the credential with the service-role client,
  then bridges into a real Supabase session via `admin.generateLink()` +
  `auth.verifyOtp()`.
- **Vercel Cron** (`vercel.json`) hits `app/api/cron/*`, gated by a
  `CRON_SECRET` bearer token.

### The ledger (important — read before touching money-moving code)

Every balance change is a row in `transactions` with a **signed** `amount`:
positive grows the pocket, negative shrinks it. `pockets.balance` only ever
changes by exactly `amount`, exactly once, at the moment a transaction's
`status` becomes `'completed'` — see `supabase/migrations/0003_functions.sql`.

A pending withdrawal request is *not* subtracted from `balance` — it's a
hold, computed on the fly by summing pending negative amounts. This is why
the UI shows both "balance" and "available" (`components/pockets/PocketCard.tsx`).

**Every money-moving action is a Postgres RPC** (`SECURITY DEFINER`,
enumerated in `0003_functions.sql`), not a raw table write — this keeps the
balance update and the log entry atomic and centralizes authorization
(RLS mostly just governs SELECT visibility + a couple of narrow,
column-restricted UPDATEs like editing a transaction's `description`).

### Multi-tenancy / RLS

Family-scoped via `SECURITY DEFINER` helper functions in
`0002_rls.sql` (`is_active_family_admin()`, `is_super_admin()`,
`is_active_family_admin_of()`, `current_profile_family_id()`). These are
owned by the migration role (`postgres`), which bypasses RLS internally —
that's what avoids infinite recursion when a policy needs to query
`profiles`/`family_admins`.

### Child accounts

Supabase Auth is email-based; kids don't have real emails. Each child gets
a synthetic one: `<username>@<familyId>.mypockets.local`
(`app/api/admin/children/route.ts`, uses the Admin API + service-role key).
The child never sees it — `resolve_child_email()` (SQL, granted to `anon`)
looks it up from a typed username so the client can call
`signInWithPassword`.

## Known gaps / next steps

- No automated tests yet.
- Email templates (confirmation / magic link) still use Supabase defaults —
  swap in branded ones from the dashboard before shipping.
- `app/[locale]/(family)/kids/[childId]/page.tsx` and the dashboard fetch
  data with a few sequential queries; fine at this scale, worth batching if
  families get large.
- No settings page yet for renaming a family/kid or removing a child
  account.

## Env setup

Copy `.env.example` → `.env.local`, fill in a Supabase project's URL/keys,
generate a `CRON_SECRET`, and get a free Alpha Vantage key for the
auto-investment-rate cron (only used if a family opts into "auto" mode —
see `app/api/cron/market-rate/route.ts`). Run the migrations + seed against
the project (SQL editor or `supabase db push`), then promote your own user
to `super_admin` per the instructions at the bottom of `supabase/seed.sql`.

`npm run dev` to run locally.
