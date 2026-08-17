export const rpName = process.env.WEBAUTHN_RP_NAME ?? "My Pockets";
export const rpID = process.env.WEBAUTHN_RP_ID ?? "localhost";
export const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const REGISTRATION_CHALLENGE_COOKIE = "mp_webauthn_reg_challenge";
export const AUTH_CHALLENGE_COOKIE = "mp_webauthn_auth_challenge";
export const CHALLENGE_COOKIE_MAX_AGE = 5 * 60; // seconds
