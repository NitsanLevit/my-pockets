import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCronSecret } from "@/lib/cron-auth";

type AlphaVantageQuote = {
  "Global Quote"?: { "10. change percent"?: string };
};

/** One request per benchmark (3 total/day) — well inside Alpha Vantage's
 * free-tier daily limit regardless of how many families/kids use the app,
 * because the fetched rate is cached and fanned out to every subscribed
 * family instead of being fetched per-family. */
async function fetchDailyChangePct(symbol: string): Promise<number | null> {
  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(
    symbol
  )}&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;

  const json = (await res.json()) as AlphaVantageQuote;
  const raw = json["Global Quote"]?.["10. change percent"];
  if (!raw) return null;

  const pct = parseFloat(raw.replace("%", ""));
  return Number.isFinite(pct) ? pct : null;
}

export async function GET(request: Request) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;

  const supabase = createAdminClient();

  const { data: benchmarks, error: benchmarksError } = await supabase
    .from("market_benchmarks")
    .select("id, api_symbol");

  if (benchmarksError) {
    return NextResponse.json({ error: benchmarksError.message }, { status: 500 });
  }

  const results: Record<string, number | null> = {};

  for (const benchmark of benchmarks ?? []) {
    const pct = await fetchDailyChangePct(benchmark.api_symbol);
    results[benchmark.id] = pct;
    if (pct === null) continue;

    await supabase
      .from("market_benchmarks")
      .update({ last_rate_pct: pct, last_fetched_at: new Date().toISOString() })
      .eq("id", benchmark.id);

    const { data: families } = await supabase
      .from("family_investment_settings")
      .select("family_id")
      .eq("mode", "auto")
      .eq("benchmark_id", benchmark.id);

    for (const { family_id } of families ?? []) {
      await supabase.rpc("apply_market_rate", {
        p_family_id: family_id,
        p_rate_pct: pct,
        p_source: "auto",
      });
    }
  }

  return NextResponse.json({ results });
}
