"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import type { AdminStatus } from "@/lib/supabase/types";

export function FamilyApprovalRow({
  familyId,
  userId,
  familyName,
  adminName,
  status,
  createdAt,
}: {
  familyId: string;
  userId: string;
  familyName: string;
  adminName: string;
  status: AdminStatus;
  createdAt: string;
}) {
  const router = useRouter();
  const format = useFormatter();
  const t = useTranslations("common");
  const adminT = useTranslations("admin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setStatus(next: "active" | "rejected") {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("set_family_admin_status", {
      p_family_id: familyId,
      p_user_id: userId,
      p_status: next,
    });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    router.refresh();
  }

  const statusStyles: Record<AdminStatus, string> = {
    pending: "bg-gold-500/15 text-gold-600",
    active: "bg-success/15 text-success",
    rejected: "bg-danger/15 text-danger",
  };

  const statusLabels: Record<AdminStatus, string> = {
    pending: adminT("statusPending"),
    active: adminT("statusActive"),
    rejected: adminT("statusRejected"),
  };

  return (
    <div className="card flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="font-medium">{familyName}</p>
        <p className="text-sm text-foreground/78">
          {adminName} ·{" "}
          {format.dateTime(new Date(createdAt), { dateStyle: "medium" })}
        </p>
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>

      <div className="flex items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[status]}`}
        >
          {statusLabels[status]}
        </span>
        {status === "pending" && (
          <>
            <button
              disabled={busy}
              onClick={() => setStatus("active")}
              className="btn-primary px-4 py-1.5 text-sm"
            >
              {t("approve")}
            </button>
            <button
              disabled={busy}
              onClick={() => setStatus("rejected")}
              className="btn-secondary px-4 py-1.5 text-sm"
            >
              {t("reject")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
