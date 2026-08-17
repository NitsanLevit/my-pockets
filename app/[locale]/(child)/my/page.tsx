import { getTranslations, getLocale } from "next-intl/server";
import { Sparkles, ListChecks } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PocketCard } from "@/components/pockets/PocketCard";
import { GRID_COLS_CLASS } from "@/components/pockets/gridCols";
import { ActivityLog, type ActivityItem } from "@/components/activity/ActivityLog";
import { WithdrawalRequestForm } from "@/components/withdrawals/WithdrawalRequestForm";
import { AllowanceSummary } from "@/components/allowance/AllowanceSummary";
import type { PocketType } from "@/lib/supabase/types";

export default async function MyPocketsPage() {
  const t = await getTranslations("pockets");
  const activityT = await getTranslations("activity");
  const locale = await getLocale();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: pockets }, { data: allowance }, { data: transactions }, { data: pendingHold }] =
    await Promise.all([
      supabase.from("profiles").select("display_name").eq("id", user!.id).single(),
      supabase.from("pockets").select("type, balance, enabled").eq("child_id", user!.id),
      supabase
        .from("allowance_configs")
        .select(
          "spend_amount, savings_amount, investments_amount, frequency, weekly_weekday, monthly_day, monthly_last_day, next_run_date, active"
        )
        .eq("child_id", user!.id)
        .eq("active", true)
        .maybeSingle(),
      supabase
        .from("transactions")
        .select("id, type, amount, status, description, created_at")
        .eq("child_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("transactions")
        .select("amount")
        .eq("child_id", user!.id)
        .eq("pocket_type", "spend")
        .eq("type", "withdrawal")
        .eq("status", "pending"),
    ]);

  const byType = Object.fromEntries((pockets ?? []).map((p) => [p.type, p.balance]));
  const enabledTypes = (pockets ?? [])
    .filter((p) => p.enabled)
    .map((p) => p.type as PocketType);
  const isEnabled = (type: PocketType) => enabledTypes.includes(type);
  const pendingSpend = (pendingHold ?? []).reduce((sum, t) => sum - t.amount, 0);
  const availableSpend = (byType.spend ?? 0) - pendingSpend;

  const items: ActivityItem[] = (transactions ?? []).map((tx) => ({
    id: tx.id,
    type: tx.type,
    amount: tx.amount,
    status: tx.status,
    description: tx.description,
    created_at: tx.created_at,
  }));

  return (
    <div className="space-y-8">
      <div className="on-light flex items-center gap-3 rounded-2xl bg-linear-to-br from-brand-100 to-teal-100 p-5 text-foreground shadow-lg">
        <span className="rounded-full bg-brand-600/15 p-2 text-brand-700">
          <Sparkles className="h-5 w-5" aria-hidden />
        </span>
        <p className="text-xl font-semibold text-foreground">
          {t("greeting", { name: profile?.display_name ?? "" })}
        </p>
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

      <AllowanceSummary config={allowance ?? null} locale={locale} />

      {isEnabled("spend") && <WithdrawalRequestForm available={availableSpend} />}

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-brand-600/10 p-1.5 text-brand-600">
            <ListChecks className="h-4 w-4" aria-hidden />
          </span>
          <h2 className="text-lg font-medium">{activityT("title")}</h2>
        </div>
        <div className="card">
          <ActivityLog items={items} />
        </div>
      </section>
    </div>
  );
}
