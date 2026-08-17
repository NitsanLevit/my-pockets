"use client";

import { useMemo, useState } from "react";
import { useTranslations, useFormatter } from "next-intl";

function futureValue(
  principal: number,
  monthlyContribution: number,
  annualRatePct: number,
  years: number
) {
  const r = annualRatePct / 100 / 12;
  const n = years * 12;
  if (r === 0) return principal + monthlyContribution * n;
  const growthFactor = Math.pow(1 + r, n);
  return principal * growthFactor + monthlyContribution * ((growthFactor - 1) / r);
}

export function FutureValueCalculator({ currentBalance }: { currentBalance: number }) {
  const t = useTranslations("investments");
  const format = useFormatter();
  const [years, setYears] = useState(5);
  const [monthly, setMonthly] = useState(0);
  const [rate, setRate] = useState(6);

  const projected = useMemo(
    () => futureValue(currentBalance, monthly, rate, years),
    [currentBalance, monthly, rate, years]
  );

  return (
    <div className="card space-y-4">
      <h3 className="font-medium">{t("futureValue")}</h3>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-foreground/80">{t("years")}</span>
          <input
            type="number"
            min={1}
            max={40}
            value={years}
            onChange={(e) => setYears(Number(e.target.value))}
            className="input"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-foreground/80">
            {t("monthlyContribution")}
          </span>
          <input
            type="number"
            min={0}
            step="0.5"
            value={monthly}
            onChange={(e) => setMonthly(Number(e.target.value))}
            className="input"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-foreground/80">{t("expectedRate")}</span>
          <input
            type="number"
            step="0.1"
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            className="input"
          />
        </label>
      </div>

      <div className="rounded-xl border-2 border-brand-900/20 bg-brand-900/10 p-4 text-center">
        <p className="text-sm text-foreground/78">{t("projectedValue")}</p>
        <p className="text-2xl font-semibold text-brand-900">
          ₪{format.number(projected, { maximumFractionDigits: 0 })}
        </p>
      </div>
    </div>
  );
}
