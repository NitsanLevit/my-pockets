"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import type { InvestmentMode } from "@/lib/supabase/types";

type Benchmark = { id: string; name: string; last_rate_pct: number | null };

export function MarketRateForm({
  familyId,
  currentMode,
  currentBenchmarkId,
  benchmarks,
}: {
  familyId: string;
  currentMode: InvestmentMode;
  currentBenchmarkId: string | null;
  benchmarks: Benchmark[];
}) {
  const t = useTranslations("investments");
  const adminT = useTranslations("admin");
  const commonT = useTranslations("common");
  const router = useRouter();
  const [mode, setMode] = useState<InvestmentMode>(currentMode);
  const [benchmarkId, setBenchmarkId] = useState(
    currentBenchmarkId ?? benchmarks[0]?.id ?? ""
  );
  const [manualRate, setManualRate] = useState("1.5");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveSettings() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: dbError } = await supabase.from("family_investment_settings").upsert({
      family_id: familyId,
      mode,
      benchmark_id: mode === "auto" ? benchmarkId : null,
      updated_at: new Date().toISOString(),
    });
    setBusy(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    router.refresh();
  }

  async function applyManualRate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("apply_market_rate", {
      p_family_id: familyId,
      p_rate_pct: parseFloat(manualRate),
      p_source: "manual",
    });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">

      <div className="flex w-fit flex-wrap gap-1 rounded-full border border-border p-1 text-sm">
        <button
          type="button"
          onClick={() => setMode("manual")}
          className={`rounded-full px-4 py-1.5 ${mode === "manual" ? "bg-brand-600 text-white" : "text-foreground/85"}`}
        >
          {t("manual")}
        </button>
        <button
          type="button"
          onClick={() => setMode("auto")}
          className={`rounded-full px-4 py-1.5 ${mode === "auto" ? "bg-brand-600 text-white" : "text-foreground/85"}`}
        >
          {t("auto")}
        </button>
      </div>

      {mode === "auto" && (
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium text-foreground/80">
            {t("benchmark")}
          </label>
          <select
            value={benchmarkId}
            onChange={(e) => setBenchmarkId(e.target.value)}
            className="input w-auto"
          >
            {benchmarks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
                {b.last_rate_pct !== null ? ` (${b.last_rate_pct}%)` : ""}
              </option>
            ))}
          </select>
          <button onClick={saveSettings} disabled={busy} className="btn-primary">
            {commonT("save")}
          </button>
        </div>
      )}

      {mode === "manual" && (
        <form onSubmit={applyManualRate} className="flex flex-wrap items-center gap-3">
          <input
            type="number"
            step="0.1"
            value={manualRate}
            onChange={(e) => setManualRate(e.target.value)}
            className="input w-28"
          />
          <span className="text-sm text-foreground/78">%</span>
          <button type="submit" disabled={busy} className="btn-primary">
            {adminT("updateRate")}
          </button>
          <button type="button" onClick={saveSettings} className="btn-secondary text-sm">
            {commonT("save")}
          </button>
        </form>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
