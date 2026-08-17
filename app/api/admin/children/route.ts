import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Creates a child account: an auth.users row with a synthetic email (kids
 * never see or type it — only their username) plus the profile + 3 pockets
 * via the `provision_child` RPC. Auth user creation needs the Admin API
 * (service-role key), which is why this can't be a plain Postgres RPC.
 */
export async function POST(request: Request) {
  const { familyId, displayName, username, password } = await request.json();

  if (!familyId || !displayName || !username || !password) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (password.length < 4) {
    return NextResponse.json(
      { error: "Password must be at least 4 characters" },
      { status: 400 }
    );
  }
  if (!/^[a-z0-9_]{3,20}$/i.test(username)) {
    return NextResponse.json(
      { error: "Username must be 3-20 letters, numbers, or underscores" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient();
  const syntheticEmail = `${username.toLowerCase()}@${familyId}.mypockets.local`;

  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email: syntheticEmail,
      password,
      email_confirm: true,
      user_metadata: { app_role: "child" },
    });

  if (createError || !created.user) {
    return NextResponse.json(
      { error: createError?.message ?? "Could not create account" },
      { status: 400 }
    );
  }

  const { error: provisionError } = await supabase.rpc("provision_child", {
    p_child_auth_id: created.user.id,
    p_family_id: familyId,
    p_display_name: displayName,
    p_username: username.toLowerCase(),
  });

  if (provisionError) {
    // Roll back the orphaned auth user so a failed attempt can be retried.
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: provisionError.message }, { status: 400 });
  }

  return NextResponse.json({ childId: created.user.id });
}
