import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { isoUint8Array } from "@simplewebauthn/server/helpers";
import { createClient } from "@/lib/supabase/server";
import {
  rpID,
  rpName,
  REGISTRATION_CHALLENGE_COOKIE,
  CHALLENGE_COOKIE_MAX_AGE,
} from "@/lib/webauthn";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name")
    .eq("id", user.id)
    .single();

  const { data: existing } = await supabase
    .from("webauthn_credentials")
    .select("credential_id, transports")
    .eq("user_id", user.id);

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: isoUint8Array.fromUTF8String(user.id),
    userName: profile?.username ?? user.id,
    userDisplayName: profile?.display_name ?? profile?.username ?? "My Pockets",
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "preferred",
    },
    excludeCredentials: (existing ?? []).map((c) => ({
      id: c.credential_id,
      transports: (c.transports ?? undefined) as
        | AuthenticatorTransport[]
        | undefined,
    })),
  });

  const response = NextResponse.json(options);
  response.cookies.set(REGISTRATION_CHALLENGE_COOKIE, options.challenge, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: CHALLENGE_COOKIE_MAX_AGE,
    path: "/",
  });
  return response;
}

// Referenced only for typing excludeCredentials transports; avoids pulling
// in the DOM lib's (slightly different) AuthenticatorTransport union.
type AuthenticatorTransport =
  | "ble"
  | "cable"
  | "hybrid"
  | "internal"
  | "nfc"
  | "smart-card"
  | "usb";
