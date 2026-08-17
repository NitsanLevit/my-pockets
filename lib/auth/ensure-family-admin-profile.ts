import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * Bridges Supabase's email-confirmation gap: `complete_family_admin_signup`
 * ideally runs right after `auth.signUp()` while a session already exists,
 * but if the project requires email confirmation, no session exists until
 * the user clicks the email link and returns — by then we're on a fresh
 * page load with no access to the signup form's values. We stash them in
 * `user_metadata` at signUp() time and finish the job here, the first time
 * we see an authenticated user with no profile row yet.
 */
export async function ensureFamilyAdminProfile(
  supabase: SupabaseClient<Database>,
  user: User
) {
  if (user.user_metadata?.app_signup !== "family_admin") return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (profile) return;

  const familyName = (user.user_metadata?.family_name as string) || "My Family";
  const displayName =
    (user.user_metadata?.display_name as string) ||
    user.email?.split("@")[0] ||
    "Admin";

  await supabase.rpc("complete_family_admin_signup", {
    p_family_name: familyName,
    p_display_name: displayName,
  });
}
