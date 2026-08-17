import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCronSecret } from "@/lib/cron-auth";

// Runs daily; the RPC itself no-ops unless today is the last day of the
// month, so it's safe to schedule this every day rather than computing
// "last day of month" in cron syntax (which cron can't express directly).
export async function GET(request: Request) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc(
    "run_savings_bonus_for_all_families_if_month_end"
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ familiesProcessed: data });
}
