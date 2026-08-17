import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { InvestmentGrowthChart } from "@/components/charts/InvestmentGrowthChart";
import { FutureValueCalculator } from "@/components/charts/FutureValueCalculator";
import { buildGrowthSeries } from "@/lib/investments/build-growth-series";

export default async function MyInvestmentsPage() {
  const t = await getTranslations("investments");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: pocket }, { data: transactions }] = await Promise.all([
    supabase
      .from("pockets")
      .select("balance")
      .eq("child_id", user!.id)
      .eq("type", "investments")
      .single(),
    supabase
      .from("transactions")
      .select("amount, created_at, status")
      .eq("child_id", user!.id)
      .eq("pocket_type", "investments")
      .order("created_at"),
  ]);

  const series = buildGrowthSeries(transactions ?? []);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-3xl font-semibold">
          ₪{(pocket?.balance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </p>
      </div>

      <section className="card">
        <h2 className="mb-3 font-medium">{t("growthChart")}</h2>
        <InvestmentGrowthChart data={series} />
      </section>

      <FutureValueCalculator currentBalance={pocket?.balance ?? 0} />
    </div>
  );
}
