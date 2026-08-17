import { getTranslations, getLocale } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Link } from "@/i18n/navigation";
import { PocketCard } from "@/components/pockets/PocketCard";
import { GRID_COLS_CLASS } from "@/components/pockets/gridCols";
import { ActivityLog, type ActivityItem } from "@/components/activity/ActivityLog";
import { AddChildForm } from "@/components/admin/AddChildForm";
import { AllowanceSummary } from "@/components/allowance/AllowanceSummary";
import type { PocketType } from "@/lib/supabase/types";

export default async function DashboardPage() {
  const t = await getTranslations("pockets");
  const navT = await getTranslations("nav");
  const activityT = await getTranslations("activity");
  const locale = await getLocale();
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

  const { data: children } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("family_id", familyId)
    .eq("role", "child")
    .order("created_at");

  const childIds = (children ?? []).map((c) => c.id);

  const { data: pockets } = childIds.length
    ? await supabase
        .from("pockets")
        .select("child_id, type, balance, enabled")
        .in("child_id", childIds)
    : { data: [] };

  const { data: allowances } = childIds.length
    ? await supabase
        .from("allowance_configs")
        .select(
          "child_id, spend_amount, savings_amount, investments_amount, frequency, weekly_weekday, monthly_day, monthly_last_day, next_run_date, active"
        )
        .in("child_id", childIds)
        .eq("active", true)
    : { data: [] };

  const allowanceByChild = new Map((allowances ?? []).map((a) => [a.child_id, a]));

  const { data: transactions } = await supabase
    .from("transactions")
    .select("id, child_id, type, amount, status, description, created_at")
    .eq("family_id", familyId)
    .order("created_at", { ascending: false })
    .limit(20);

  const nameByChild = new Map((children ?? []).map((c) => [c.id, c.display_name]));

  const items: ActivityItem[] = (transactions ?? []).map((tx) => ({
    id: tx.id,
    type: tx.type,
    amount: tx.amount,
    status: tx.status,
    description: tx.description,
    created_at: tx.created_at,
    childName: nameByChild.get(tx.child_id),
  }));

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">{navT("kids")}</h1>
          <AddChildForm familyId={familyId} />
        </div>

        {(children ?? []).length === 0 && (
          <p className="text-sm text-foreground/78">{navT("noKidsYet")}</p>
        )}

        <div className="space-y-6">
          {(children ?? []).map((child) => {
            const childPockets = (pockets ?? []).filter(
              (p) => p.child_id === child.id
            );
            const byType = Object.fromEntries(
              childPockets.map((p) => [p.type, p.balance])
            );
            const enabledTypes = childPockets
              .filter((p) => p.enabled)
              .map((p) => p.type as PocketType);
            const isEnabled = (type: PocketType) => enabledTypes.includes(type);
            const allowance = allowanceByChild.get(child.id) ?? null;
            return (
              <Link
                key={child.id}
                href={`/kids/${child.id}`}
                className="on-light block space-y-3 rounded-2xl bg-surface p-4 text-foreground shadow-lg transition-colors hover:bg-surface-muted"
              >
                <div className="flex items-center justify-between">
                  <span className="text-lg font-medium text-foreground">
                    {child.display_name}
                  </span>
                  <ArrowRight
                    className="h-5 w-5 flip-rtl text-foreground/65"
                    aria-hidden
                  />
                </div>
                <AllowanceSummary config={allowance} locale={locale} compact />
                {enabledTypes.length === 0 ? (
                  <p className="text-sm text-foreground/72">{t("noPocketsEnabled")}</p>
                ) : (
                  <div className={`grid gap-2 ${GRID_COLS_CLASS[enabledTypes.length]}`}>
                    {isEnabled("spend") && (
                      <PocketCard type="spend" label={t("spend")} balance={byType.spend ?? 0} />
                    )}
                    {isEnabled("savings") && (
                      <PocketCard
                        type="savings"
                        label={t("savings")}
                        balance={byType.savings ?? 0}
                      />
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
              </Link>
            );
          })}
        </div>
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
