import { NextResponse } from "next/server";

/** Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` automatically
 * once CRON_SECRET is set as a project env var — this rejects everyone else. */
export function requireCronSecret(request: Request): NextResponse | null {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
