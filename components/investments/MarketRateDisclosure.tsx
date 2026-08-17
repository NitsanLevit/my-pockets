"use client";

import { Settings } from "lucide-react";
import { useTranslations } from "next-intl";
import { Disclosure } from "@/components/ui/Disclosure";
import { MarketRateForm } from "@/components/investments/MarketRateForm";
import type { InvestmentMode } from "@/lib/supabase/types";

type Benchmark = { id: string; name: string; last_rate_pct: number | null };

export function MarketRateDisclosure({
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

  return (
    <Disclosure label={t("mode")} icon={Settings}>
      <MarketRateForm
        familyId={familyId}
        currentMode={currentMode}
        currentBenchmarkId={currentBenchmarkId}
        benchmarks={benchmarks}
      />
    </Disclosure>
  );
}
