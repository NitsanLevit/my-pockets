"use client";

import { useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

type LatestRun = {
  id: string;
  run_date: string;
  status: "applied" | "undone";
} | null;

export function SavingsBonusPanel({
  familyId,
  latestRun,
}: {
  familyId: string;
  latestRun: LatestRun;
}) {
  const t = useTranslations("admin");
  const format = useFormatter();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "apply" | "undo" | "recalculate") {
    setBusy(true);
    setError(null);
    const supabase = createClient();

    const { error: rpcError } =
      action === "apply"
        ? await supabase.rpc("run_savings_bonus", { p_family_id: familyId })
        : action === "undo"
          ? await supabase.rpc("undo_savings_bonus", { p_run_id: latestRun!.id })
          : await supabase.rpc("recalculate_savings_bonus", {
              p_run_id: latestRun!.id,
            });

    setBusy(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="card space-y-3">
      <h3 className="font-medium">{t("savingsBonusTitle")}</h3>
      <p className="text-sm text-foreground/78">{t("savingsBonusDescription")}</p>

      {latestRun && (
        <p className="text-sm">
          {t("lastRun")}:{" "}
          {format.dateTime(new Date(latestRun.run_date), {
            dateStyle: "medium",
            timeZone: "UTC",
          })}{" "}
          —{" "}
          <span className={latestRun.status === "applied" ? "text-success" : "text-foreground/72"}>
            {t(latestRun.status === "applied" ? "bonusStatusApplied" : "bonusStatusUndone")}
          </span>
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button disabled={busy} onClick={() => run("apply")} className="btn-primary">
          {t("applyBonus")}
        </button>
        {latestRun?.status === "applied" && (
          <>
            <button disabled={busy} onClick={() => run("undo")} className="btn-secondary">
              {t("undoBonus")}
            </button>
            <button
              disabled={busy}
              onClick={() => run("recalculate")}
              className="btn-secondary"
            >
              {t("recalculate")}
            </button>
          </>
        )}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
