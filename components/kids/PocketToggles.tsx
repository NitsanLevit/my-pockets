"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Wallet, PiggyBank, TrendingUp } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import type { PocketType } from "@/lib/supabase/types";

const ICONS: Record<PocketType, typeof Wallet> = {
  spend: Wallet,
  savings: PiggyBank,
  investments: TrendingUp,
};

const ORDER: PocketType[] = ["spend", "savings", "investments"];

const ON_ACCENTS: Record<PocketType, string> = {
  spend: "border-brand-300 bg-brand-50 text-brand-700",
  savings: "border-teal-500/40 bg-teal-400/15 text-teal-600",
  investments: "border-brand-900/40 bg-brand-900/10 text-brand-900",
};

export function PocketToggles({
  childId,
  enabledTypes,
}: {
  childId: string;
  enabledTypes: PocketType[];
}) {
  const t = useTranslations("pockets");
  const router = useRouter();
  const [pending, setPending] = useState<PocketType | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(type: PocketType, next: boolean) {
    setPending(type);
    setError(null);
    const supabase = createClient();
    const { error: dbError } = await supabase
      .from("pockets")
      .update({ enabled: next })
      .eq("child_id", childId)
      .eq("type", type);
    setPending(null);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-foreground/78">{t("choosePocketsHint")}</p>
      <div className="flex flex-wrap gap-2">
        {ORDER.map((type) => {
          const Icon = ICONS[type];
          const isOn = enabledTypes.includes(type);
          return (
            <button
              key={type}
              type="button"
              disabled={pending === type}
              onClick={() => toggle(type, !isOn)}
              aria-pressed={isOn}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${
                isOn ? ON_ACCENTS[type] : "border-border bg-surface text-foreground/72"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {t(type)}
            </button>
          );
        })}
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
