import type { AllowanceFrequency } from "@/lib/supabase/types";

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function lastDayOfMonth(year: number, month: number): Date {
  // month is 0-indexed; day 0 of the next month is the last day of this one.
  return new Date(year, month + 1, 0);
}

const WEEKDAY_ANCHOR_UTC = Date.UTC(2023, 0, 1); // a Sunday

/** Locale-correct weekday name for day 0 (Sunday) - 6 (Saturday). */
export function weekdayName(
  locale: string,
  day: number,
  style: "short" | "long" = "short"
): string {
  return new Intl.DateTimeFormat(locale, { weekday: style }).format(
    new Date(WEEKDAY_ANCHOR_UTC + day * 86400000)
  );
}

/**
 * Finds the next occurrence (today or later) of the chosen weekly/monthly
 * schedule, for seeding a new allowance config's `next_run_date`.
 */
export function computeInitialNextRunDate(
  frequency: AllowanceFrequency,
  opts: {
    weeklyWeekday?: number;
    monthlyDay?: number;
    monthlyLastDay?: boolean;
  }
): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (frequency === "weekly") {
    const target = opts.weeklyWeekday ?? today.getDay();
    const diff = (target - today.getDay() + 7) % 7;
    const next = new Date(today);
    next.setDate(today.getDate() + diff);
    return toDateString(next);
  }

  if (frequency === "monthly") {
    if (opts.monthlyLastDay) {
      const thisMonthLast = lastDayOfMonth(today.getFullYear(), today.getMonth());
      const candidate = thisMonthLast >= today
        ? thisMonthLast
        : lastDayOfMonth(today.getFullYear(), today.getMonth() + 1);
      return toDateString(candidate);
    }

    const day = opts.monthlyDay ?? today.getDate();
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), day);
    const candidate = thisMonth >= today
      ? thisMonth
      : new Date(today.getFullYear(), today.getMonth() + 1, day);
    return toDateString(candidate);
  }

  return toDateString(today);
}
