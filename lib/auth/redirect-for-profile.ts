import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "@/i18n/navigation";
import type { Database } from "@/lib/supabase/types";

/**
 * Sends an authenticated user to the right home screen for their role.
 * Called from the landing page and from auth callback routes right after
 * a session is established.
 *
 * Note: `redirect()` is typed to return `never`, but in this project's
 * module-resolution setup TypeScript doesn't reliably treat bare calls to
 * it as control-flow-terminating (no narrowing, "unreachable end point"
 * complaints) — so this uses explicit `return` after every call instead of
 * relying on that inference, and `Promise<void>` rather than `Promise<never>`.
 */
export async function redirectForProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
  locale: string
): Promise<void> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, family_id")
    .eq("id", userId)
    .single();

  if (!profile) {
    // Authenticated but no profile row — e.g. a leftover account from
    // before `shouldCreateUser: false` was added to the magic-link flow.
    // Sending them to /login while still signed in would just loop (they
    // stay authenticated, land back here, get bounced again), so sign out
    // first to break the cycle.
    await supabase.auth.signOut();
    redirect({ href: "/login?error=no_account", locale });
    return;
  }

  if (profile.role === "super_admin") {
    redirect({ href: "/admin/families", locale });
    return;
  }

  if (profile.role === "child") {
    const { count } = await supabase
      .from("webauthn_credentials")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    redirect({ href: count ? "/my" : "/my/passkey-setup", locale });
    return;
  }

  // family_admin — check approval status for their family
  if (profile.family_id) {
    const { data: membership } = await supabase
      .from("family_admins")
      .select("status")
      .eq("family_id", profile.family_id)
      .eq("user_id", userId)
      .single();

    if (membership?.status === "active") {
      redirect({ href: "/dashboard", locale });
      return;
    }
  }

  redirect({ href: "/pending-approval", locale });
}
