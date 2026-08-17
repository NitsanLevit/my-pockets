import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * Service-role client. Bypasses RLS entirely — only import this from
 * cron routes (`app/api/cron/**`) and admin-only Route Handlers that need
 * to act across families (e.g. super-admin approval, child account
 * creation with the Auth Admin API). Never import into a Server/Client
 * Component or an RPC caller that runs on behalf of a single user.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
