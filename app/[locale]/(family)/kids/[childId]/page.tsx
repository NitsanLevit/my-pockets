import { notFound } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Link } from "@/i18n/navigation";
import { PocketCard } from "@/components/pockets/PocketCard";
import { GRID_COLS_CLASS } from "@/components/pockets/gridCols";
import { ActivityLog, type ActivityItem } from "@/components/activity/ActivityLog";
import { AllowanceSummary } from "@/components/allowance/AllowanceSummary";
import { KidActionsMenu } from "@/components/kids/KidActionsMenu";
import type { PocketType } from "@/lib/supabase/types";

export default async function KidDetailPage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = await params;
  const t = await getTranslations("pockets");
  const activityT = await getTranslations("activity");
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: child } = await supabase
    .from("profiles")
    .select("id, display_name, username")
    .eq("id", childId)
    .eq("role", "child")
    .single();

  if (!child) notFound();

  const [{ data: pockets }, { data: allowance }, { data: transactions }] =
    await Promise.all([
      supabase.from("pockets").select("type, balance, enabled").eq("child_id", childId),
      supabase
        .from("allowance_configs")
        .select(
          "id, spend_amount, savings_amount, investments_amount, frequency, interval_days, weekly_weekday, monthly_day, monthly_last_day, next_run_date, active"
        )
        .eq("child_id", childId)
        .eq("active", true)
        .maybeSingle(),
      supabase
        .from("transactions")
        .select("id, type, amount, status, description, created_at, pocket_type")
        .eq("child_id", childId)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

  const byType = Object.fromEntries((pockets ?? []).map((p) => [p.type, p.balance]));
  const enabledTypes = (pockets ?? [])
    .filter((p) => p.enabled)
    .map((p) => p.type as PocketType);
  const isEnabled = (type: PocketType) => enabledTypes.includes(type);

  const { data: pendingHold } = await supabase
    .from("transactions")
    .select("amount")
    .eq("child_id", childId)
    .eq("pocket_type", "spend")
    .eq("type", "withdrawal")
    .eq("status", "pending");

  const pendingSpend = (pendingHold ?? []).reduce((sum, t) => sum - t.amount, 0);

  const items: ActivityItem[] = (transactions ?? []).map((tx) => ({
    id: tx.id,
    type: tx.type,
    pocket_type: tx.pocket_type,
    amount: tx.amount,
    status: tx.status,
    description: tx.description,
    created_at: tx.created_at,
  }));

  return (
    <div className="space-y-8">
      <div className="on-light space-y-5 rounded-2xl bg-linear-to-br from-brand-100 to-teal-100 p-5 text-foreground shadow-lg">
        <div>
          <h1 className="text-2xl font-semibold">{child.display_name}</h1>
          <p className="text-sm text-foreground/72">@{child.username}</p>
        </div>

        {enabledTypes.length === 0 ? (
          <p className="text-sm text-foreground/78">{t("noPocketsEnabled")}</p>
        ) : (
          <div className={`grid gap-2 sm:gap-3 ${GRID_COLS_CLASS[enabledTypes.length]}`}>
            {isEnabled("spend") && (
              <PocketCard
                type="spend"
                label={t("spend")}
                balance={byType.spend ?? 0}
                pending={pendingSpend}
                pendingLabel={t("pending")}
              />
            )}
            {isEnabled("savings") && (
              <PocketCard type="savings" label={t("savings")} balance={byType.savings ?? 0} />
            )}
            {isEnabled("investments") && (
              <PocketCard
                type="investments"
                label={t("investments")}
                balance={byType.investments ?? 0}
              />
            )}
          </div>
        )}

        {isEnabled("investments") && (
          <Link
            href={`/kids/${childId}/investments`}
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            {t("investments")}
            <ArrowRight className="h-4 w-4 flip-rtl" aria-hidden />
          </Link>
        )}
      </div>

      <section className="space-y-3">
        <AllowanceSummary config={allowance ?? null} locale={locale} />
        <KidActionsMenu
          childId={childId}
          existingAllowance={allowance ?? null}
          enabledTypes={enabledTypes}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">{activityT("title")}</h2>
        <div className="card">
          <ActivityLog items={items} canApprove />
        </div>
      </section>
    </div>
  );
}
