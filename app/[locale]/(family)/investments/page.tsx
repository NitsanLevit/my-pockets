import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Link } from "@/i18n/navigation";
import { MarketRateDisclosure } from "@/components/investments/MarketRateDisclosure";
import { SavingsBonusPanel } from "@/components/investments/SavingsBonusPanel";

export default async function FamilyInvestmentsPage() {
  const t = await getTranslations("investments");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("family_id")
    .eq("id", user!.id)
    .single();
  const familyId = profile!.family_id!;

  const [{ data: settings }, { data: benchmarks }, { data: latestRun }, { data: children }] =
    await Promise.all([
      supabase
        .from("family_investment_settings")
        .select("mode, benchmark_id")
        .eq("family_id", familyId)
        .maybeSingle(),
      supabase.from("market_benchmarks").select("id, name, last_rate_pct"),
      supabase
        .from("savings_bonus_runs")
        .select("id, run_date, status")
        .eq("family_id", familyId)
        .order("run_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("id, display_name")
        .eq("family_id", familyId)
        .eq("role", "child"),
    ]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">{t("pageTitle")}</h1>

      <MarketRateDisclosure
        familyId={familyId}
        currentMode={settings?.mode ?? "manual"}
        currentBenchmarkId={settings?.benchmark_id ?? null}
        benchmarks={benchmarks ?? []}
      />

      <SavingsBonusPanel familyId={familyId} latestRun={latestRun ?? null} />

      <section className="space-y-2">
        <h2 className="text-lg font-medium">{t("perKidCharts")}</h2>
        <ul className="space-y-1">
          {(children ?? []).map((c) => (
            <li key={c.id}>
              <Link
                href={`/kids/${c.id}/investments`}
                className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-700"
              >
                {c.display_name}
                <ArrowRight className="h-4 w-4 flip-rtl" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
