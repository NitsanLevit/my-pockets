import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rpID, origin, AUTH_CHALLENGE_COOKIE } from "@/lib/webauthn";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const expectedChallenge = cookieStore.get(AUTH_CHALLENGE_COOKIE)?.value;
  if (!expectedChallenge) {
    return NextResponse.json({ error: "Challenge expired" }, { status: 400 });
  }

  const body: AuthenticationResponseJSON = await request.json();
  const admin = createAdminClient();

  const { data: credentialRow } = await admin
    .from("webauthn_credentials")
    .select("id, user_id, public_key, counter, transports")
    .eq("credential_id", body.id)
    .single();

  if (!credentialRow) {
    return NextResponse.json({ error: "Unknown passkey" }, { status: 400 });
  }

  const verification = await verifyAuthenticationResponse({
    response: body,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: {
      id: body.id,
      publicKey: isoBase64URL.toBuffer(credentialRow.public_key),
      counter: Number(credentialRow.counter),
      transports: (credentialRow.transports ?? undefined) as never,
    },
  });

  if (!verification.verified) {
    return NextResponse.json({ error: "Verification failed" }, { status: 400 });
  }

  await admin
    .from("webauthn_credentials")
    .update({
      counter: verification.authenticationInfo.newCounter,
      last_used_at: new Date().toISOString(),
    })
    .eq("id", credentialRow.id);

  const { data: authUser, error: userError } =
    await admin.auth.admin.getUserById(credentialRow.user_id);
  if (userError || !authUser.user?.email) {
    return NextResponse.json({ error: "Account not found" }, { status: 400 });
  }

  const { data: link, error: linkError } = await admin.auth.admin.generateLink(
    { type: "magiclink", email: authUser.user.email }
  );
  if (linkError || !link) {
    return NextResponse.json({ error: linkError?.message }, { status: 400 });
  }

  // Establish the real Supabase session — this writes the session cookies
  // via `next/headers`, which Route Handlers (unlike Server Components)
  // are allowed to mutate.
  const supabase = await createClient();
  const { error: otpError } = await supabase.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: "magiclink",
  });
  if (otpError) {
    return NextResponse.json({ error: otpError.message }, { status: 400 });
  }

  const response = NextResponse.json({ verified: true });
  response.cookies.delete(AUTH_CHALLENGE_COOKIE);
  return response;
}
