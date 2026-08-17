"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, PiggyBank, Wallet, LayoutGrid, type LucideIcon } from "lucide-react";
import { AdminAdjustForm } from "@/components/admin/AdminAdjustForm";
import { AllowanceForm } from "@/components/allowance/AllowanceForm";
import { PocketToggles } from "@/components/kids/PocketToggles";
import type { AllowanceFrequency, PocketType } from "@/lib/supabase/types";

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

type PanelKey = "adjust" | "allowance" | "pockets";

const ACCENTS: Record<PanelKey, string> = {
  adjust: "bg-brand-600/10 text-brand-600",
  allowance: "bg-teal-500/15 text-teal-600",
  pockets: "bg-brand-900/10 text-brand-900",
};

export function KidActionsMenu({
  childId,
  existingAllowance,
  enabledTypes,
}: {
  childId: string;
  existingAllowance: ExistingConfig | null;
  enabledTypes: PocketType[];
}) {
  const t = useTranslations("admin");
  const allowanceT = useTranslations("allowance");
  const pocketsT = useTranslations("pockets");
  const [active, setActive] = useState<PanelKey | null>(null);

  function toggle(panel: PanelKey) {
    setActive((current) => (current === panel ? null : panel));
  }

  const items: { key: PanelKey; label: string; icon: LucideIcon; panel: ReactNode }[] = [
    ...(enabledTypes.length > 0
      ? [
          {
            key: "adjust" as const,
            label: t("adjustBalance"),
            icon: Wallet,
            panel: <AdminAdjustForm childId={childId} enabledTypes={enabledTypes} />,
          },
        ]
      : []),
    {
      key: "allowance" as const,
      label: allowanceT("title"),
      icon: PiggyBank,
      panel: (
        <AllowanceForm
          childId={childId}
          existing={existingAllowance}
          enabledTypes={enabledTypes}
        />
      ),
    },
    {
      key: "pockets" as const,
      label: pocketsT("choosePockets"),
      icon: LayoutGrid,
      panel: <PocketToggles childId={childId} enabledTypes={enabledTypes} />,
    },
  ];

  return (
    <div className="on-light overflow-hidden rounded-2xl bg-surface shadow-lg">
      {items.map((item, i) => {
        const isOpen = active === item.key;
        return (
          <div key={item.key} className={i > 0 ? "border-t border-border" : ""}>
            <button
              type="button"
              onClick={() => toggle(item.key)}
              aria-expanded={isOpen}
              className={`flex w-full items-center gap-3 px-4 py-3 text-start transition-colors ${
                isOpen ? "bg-surface-muted" : "bg-surface hover:bg-surface-muted"
              }`}
            >
              <span className={`rounded-lg p-2 ${ACCENTS[item.key]}`}>
                <item.icon className="h-4 w-4" aria-hidden />
              </span>
              <span className="flex-1 text-sm font-medium text-foreground">
                {item.label}
              </span>
              <ChevronDown
                className={`h-4 w-4 text-foreground/65 transition-transform ${isOpen ? "rotate-180" : ""}`}
                aria-hidden
              />
            </button>
            {isOpen && (
              <div className="border-t border-border bg-surface-muted p-4">
                {item.panel}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
