"use client";

import { useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { Pencil, Check, X } from "lucide-react";
import type { TransactionType } from "@/lib/supabase/types";

export type ActivityItem = {
  id: string;
  type: TransactionType;
  amount: number;
  status: "pending" | "completed" | "rejected";
  description: string | null;
  created_at: string;
  childName?: string;
};

export function ActivityLog({
  items,
  currency = "₪",
  canApprove = false,
}: {
  items: ActivityItem[];
  currency?: string;
  canApprove?: boolean;
}) {
  const t = useTranslations("activity");

  if (items.length === 0) {
    return <p className="text-sm font-medium text-foreground/78">{t("noActivity")}</p>;
  }

  return (
    <div className="divide-y divide-border">
      {items.map((item) => (
        <ActivityRow
          key={item.id}
          item={item}
          currency={currency}
          canApprove={canApprove}
        />
      ))}
    </div>
  );
}

function ActivityRow({
  item,
  currency,
  canApprove,
}: {
  item: ActivityItem;
  currency: string;
  canApprove: boolean;
}) {
  const t = useTranslations("activity");
  const format = useFormatter();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState(item.description ?? "");
  const [busy, setBusy] = useState(false);

  async function saveDescription() {
    setBusy(true);
    const supabase = createClient();
    await supabase.from("transactions").update({ description }).eq("id", item.id);
    setBusy(false);
    setEditing(false);
    router.refresh();
  }

  async function respond(action: "approve" | "reject") {
    setBusy(true);
    const supabase = createClient();
    await supabase.rpc(
      action === "approve" ? "approve_withdrawal" : "reject_withdrawal",
      { p_transaction_id: item.id }
    );
    setBusy(false);
    router.refresh();
  }

  const isNegative = item.amount < 0;

  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {t(item.type)}
          {item.childName && (
            <span className="font-normal text-foreground/72"> · {item.childName}</span>
          )}
          {item.status === "pending" && (
            <span className="ms-2 rounded-full bg-gold-500/15 px-2 py-0.5 text-xs text-gold-600">
              {t("pending")}
            </span>
          )}
          {item.status === "rejected" && (
            <span className="ms-2 rounded-full bg-danger/15 px-2 py-0.5 text-xs text-danger">
              rejected
            </span>
          )}
        </p>

        {editing ? (
          <div className="mt-1 flex items-center gap-1">
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input py-1 text-sm"
              autoFocus
            />
            <button onClick={saveDescription} disabled={busy} aria-label="save">
              <Check className="h-4 w-4 text-success" />
            </button>
            <button onClick={() => setEditing(false)} aria-label="cancel">
              <X className="h-4 w-4 text-foreground/65" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="mt-0.5 flex items-center gap-1 text-xs text-foreground/72 hover:text-foreground/80"
          >
            {item.description || "Add a note"}
            <Pencil className="h-3 w-3" aria-hidden />
          </button>
        )}
        <p className="text-xs text-foreground/65">
          {format.dateTime(new Date(item.created_at), {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <span
          className={`text-sm font-semibold ${isNegative ? "text-danger" : "text-success"}`}
        >
          {isNegative ? "-" : "+"}
          {currency}
          {format.number(Math.abs(item.amount), {
            minimumFractionDigits: 2,
          })}
        </span>
        {canApprove && item.status === "pending" && (
          <div className="flex gap-1">
            <button
              disabled={busy}
              onClick={() => respond("approve")}
              className="rounded-lg bg-success/15 px-2 py-1 text-xs font-medium text-success hover:bg-success/25"
            >
              ✓
            </button>
            <button
              disabled={busy}
              onClick={() => respond("reject")}
              className="rounded-lg bg-danger/15 px-2 py-1 text-xs font-medium text-danger hover:bg-danger/25"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
