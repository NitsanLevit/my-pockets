"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import type { PocketType } from "@/lib/supabase/types";

const ORDER: PocketType[] = ["spend", "savings", "investments"];

export function AdminAdjustForm({
  childId,
  enabledTypes,
}: {
  childId: string;
  enabledTypes: PocketType[];
}) {
  const t = useTranslations("admin");
  const pocketsT = useTranslations("pockets");
  const router = useRouter();
  const options = ORDER.filter((type) => enabledTypes.includes(type));
  const [pocketType, setPocketType] = useState<PocketType>(
    options[0] ?? "spend"
  );
  const [direction, setDirection] = useState<"deposit" | "withdrawal">("deposit");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("admin_adjust_balance", {
      p_child_id: childId,
      p_pocket_type: pocketType,
      p_amount: parseFloat(amount),
      p_direction: direction,
      p_description: description || null,
    });

    setBusy(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setAmount("");
    setDescription("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-5">
      <select
        value={pocketType}
        onChange={(e) => setPocketType(e.target.value as PocketType)}
        className="input"
      >
        {options.map((type) => (
          <option key={type} value={type}>
            {pocketsT(type)}
          </option>
        ))}
      </select>
      <select
        value={direction}
        onChange={(e) => setDirection(e.target.value as "deposit" | "withdrawal")}
        className="input"
      >
        <option value="deposit">{t("directDeposit")}</option>
        <option value="withdrawal">{t("directWithdrawal")}</option>
      </select>
      <input
        required
        type="number"
        step="0.01"
        min="0.01"
        placeholder="₪"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="input"
      />
      <input
        placeholder={t("notePlaceholder")}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="input sm:col-span-1"
      />
      <button type="submit" disabled={busy} className="btn-primary">
        {direction === "deposit" ? t("directDeposit") : t("directWithdrawal")}
      </button>
      {error && <p className="col-span-full text-sm text-danger">{error}</p>}
    </form>
  );
}
