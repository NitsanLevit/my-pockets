import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import {
  rpID,
  AUTH_CHALLENGE_COOKIE,
  CHALLENGE_COOKIE_MAX_AGE,
} from "@/lib/webauthn";

// No username required — registered with residentKey: 'required', so the
// browser/OS shows the user a picker of discoverable credentials for this
// site (Face ID / Touch ID prompt) without us needing to know who it is yet.
export async function GET() {
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "preferred",
  });

  const response = NextResponse.json(options);
  response.cookies.set(AUTH_CHALLENGE_COOKIE, options.challenge, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: CHALLENGE_COOKIE_MAX_AGE,
    path: "/",
  });
  return response;
}
