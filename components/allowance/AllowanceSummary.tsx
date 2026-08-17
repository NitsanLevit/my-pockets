import { getTranslations } from "next-intl/server";
import { CalendarClock } from "lucide-react";
import { weekdayName } from "@/lib/allowance/schedule";
import type { AllowanceFrequency } from "@/lib/supabase/types";

type Config = {
  spend_amount: number;
  savings_amount: number;
  investments_amount: number;
  frequency: AllowanceFrequency;
  weekly_weekday: number | null;
  monthly_day: number | null;
  monthly_last_day: boolean;
  next_run_date: string;
} | null;

function formatDate(locale: string, isoDate: string) {
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(
    new Date(`${isoDate}T00:00:00`)
  );
}

export async function AllowanceSummary({
  config,
  locale,
  compact = false,
  currency = "₪",
}: {
  config: Config;
  locale: string;
  compact?: boolean;
  currency?: string;
}) {
  const t = await getTranslations("allowance");

  if (!config) {
    return <p className="text-sm text-foreground/72">{t("noneSet")}</p>;
  }

  const frequencyText =
    config.frequency === "weekly" && config.weekly_weekday !== null
      ? t("everyWeekday", { day: weekdayName(locale, config.weekly_weekday, "long") })
      : config.monthly_last_day
        ? t("monthlyOnLastDay")
        : config.monthly_day !== null
          ? t("monthlyOnDay", { day: config.monthly_day })
          : "";

  const nextDate = formatDate(locale, config.next_run_date);
  const total = config.spend_amount + config.savings_amount + config.investments_amount;

  if (compact) {
    return (
      <p className="text-sm font-medium text-foreground/85">
        {currency}
        {total.toFixed(2)} · {frequencyText} · {t("nextPayment")}: {nextDate}
      </p>
    );
  }

  return (
    <div className="on-light flex items-start gap-3 rounded-2xl border-t-4 border-t-brand-600 bg-surface p-4 text-sm text-foreground shadow-lg">
      <span className="rounded-lg bg-brand-600/10 p-2 text-brand-600">
        <CalendarClock className="h-4 w-4" aria-hidden />
      </span>
      <div className="space-y-1">
        <p className="font-medium text-foreground/80">{frequencyText}</p>
        <p className="text-foreground/78">
          {t("nextPayment")}: {nextDate}
        </p>
        <p className="text-foreground/78">
          {currency}
          {config.spend_amount.toFixed(2)} · {currency}
          {config.savings_amount.toFixed(2)} · {currency}
          {config.investments_amount.toFixed(2)}
        </p>
      </div>
    </div>
  );
}
