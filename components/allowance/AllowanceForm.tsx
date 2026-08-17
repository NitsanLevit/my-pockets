"use client";

import { useState, type FormEvent } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { computeInitialNextRunDate, weekdayName } from "@/lib/allowance/schedule";
import type { AllowanceFrequency } from "@/lib/supabase/types";

type ExistingConfig = {
  id: string;
  spend_amount: number;
  savings_amount: number;
  investments_amount: number;
  frequency: AllowanceFrequency;
  interval_days: number | null;
  weekly_weekday: number | null;
  monthly_day: number | null;
  monthly_last_day: boolean;
  active: boolean;
};

export function AllowanceForm({
  childId,
  existing,
}: {
  childId: string;
  existing: ExistingConfig | null;
}) {
  const t = useTranslations("allowance");
  const locale = useLocale();
  const router = useRouter();
  const [spend, setSpend] = useState(String(existing?.spend_amount ?? 1));
  const [savings, setSavings] = useState(String(existing?.savings_amount ?? 1));
  const [investments, setInvestments] = useState(
    String(existing?.investments_amount ?? 1)
  );
  const [frequency, setFrequency] = useState<"weekly" | "monthly">(
    existing?.frequency === "monthly" ? "monthly" : "weekly"
  );
  const [weeklyWeekday, setWeeklyWeekday] = useState(
    existing?.weekly_weekday ?? new Date().getDay()
  );
  const [monthlyDay, setMonthlyDay] = useState(
    existing?.monthly_day ?? new Date().getDate()
  );
  const [monthlyLastDay, setMonthlyLastDay] = useState(
    existing?.monthly_last_day ?? false
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const spendN = parseFloat(spend) || 0;
  const savingsN = parseFloat(savings) || 0;
  const investmentsN = parseFloat(investments) || 0;
  const total = spendN + savingsN + investmentsN;
  const belowMin = spendN < 1 || savingsN < 1 || investmentsN < 1;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (belowMin) {
      setError(t("minError"));
      return;
    }
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const payload = {
      child_id: childId,
      spend_amount: spendN,
      savings_amount: savingsN,
      investments_amount: investmentsN,
      frequency,
      interval_days: null,
      weekly_weekday: frequency === "weekly" ? weeklyWeekday : null,
      monthly_day:
        frequency === "monthly" && !monthlyLastDay ? monthlyDay : null,
      monthly_last_day: frequency === "monthly" && monthlyLastDay,
      active: true,
    };

    const { error: dbError } = existing
      ? await supabase.from("allowance_configs").update(payload).eq("id", existing.id)
      : await supabase.from("allowance_configs").insert({
          ...payload,
          created_by: user!.id,
          next_run_date: computeInitialNextRunDate(frequency, {
            weeklyWeekday,
            monthlyDay,
            monthlyLastDay,
          }),
        });

    setBusy(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 xs:grid-cols-3">
        <AmountField label={t("spendSplit")} value={spend} onChange={setSpend} />
        <AmountField label={t("savingsSplit")} value={savings} onChange={setSavings} />
        <AmountField
          label={t("investSplit")}
          value={investments}
          onChange={setInvestments}
        />
      </div>

      <p className="text-sm text-foreground/78">
        {t("totalAmount")}: ₪{total.toFixed(2)}
      </p>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium text-foreground/80">
            {t("frequency")}
          </label>
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as "weekly" | "monthly")}
            className="input w-auto"
          >
            <option value="weekly">{t("weekly")}</option>
            <option value="monthly">{t("monthly")}</option>
          </select>
        </div>

        {frequency === "weekly" && (
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground/80">{t("weekday")}</p>
            <div className="flex flex-wrap gap-1">
              {Array.from({ length: 7 }, (_, day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => setWeeklyWeekday(day)}
                  className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                    weeklyWeekday === day
                      ? "bg-brand-600 text-white"
                      : "border border-border text-foreground/85 hover:bg-surface-muted"
                  }`}
                >
                  {weekdayName(locale, day)}
                </button>
              ))}
            </div>
          </div>
        )}

        {frequency === "monthly" && (
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <span className="font-medium text-foreground/80">{t("dayOfMonth")}</span>
              <select
                value={monthlyDay}
                disabled={monthlyLastDay}
                onChange={(e) => setMonthlyDay(parseInt(e.target.value, 10))}
                className="input w-auto disabled:opacity-50"
              >
                {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground/80">
              <input
                type="checkbox"
                checked={monthlyLastDay}
                onChange={(e) => setMonthlyLastDay(e.target.checked)}
              />
              {t("lastDayOfMonth")}
            </label>
          </div>
        )}
      </div>

      {belowMin && <p className="text-sm text-danger">{t("minError")}</p>}
      {error && <p className="text-sm text-danger">{error}</p>}

      <button type="submit" disabled={busy} className="btn-primary">
        {existing ? t("update") : t("start")}
      </button>
    </form>
  );
}

function AmountField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium text-foreground/80">{label}</span>
      <input
        type="number"
        min={1}
        step="0.5"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input"
      />
    </label>
  );
}
