import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { InvestmentGrowthChart } from "@/components/charts/InvestmentGrowthChart";
import { FutureValueCalculator } from "@/components/charts/FutureValueCalculator";
import { buildGrowthSeries } from "@/lib/investments/build-growth-series";

export default async function KidInvestmentsPage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = await params;
  const t = await getTranslations("investments");
  const supabase = await createClient();

  const { data: child } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("id", childId)
    .single();
  if (!child) notFound();

  const [{ data: pocket }, { data: transactions }] = await Promise.all([
    supabase
      .from("pockets")
      .select("balance")
      .eq("child_id", childId)
      .eq("type", "investments")
      .single(),
    supabase
      .from("transactions")
      .select("amount, created_at, status")
      .eq("child_id", childId)
      .eq("pocket_type", "investments")
      .order("created_at"),
  ]);

  const series = buildGrowthSeries(transactions ?? []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">{child.display_name}</h1>
        <p className="text-foreground/78">
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
