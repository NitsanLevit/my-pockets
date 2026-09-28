"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { HandCoins } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

export function WithdrawalRequestForm({ available }: { available: number }) {
  const t = useTranslations("withdrawal");
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const { data: transactionId, error: rpcError } = await supabase.rpc("request_withdrawal", {
      p_amount: parseFloat(amount),
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

    // Best-effort push notification to family admins — the request itself
    // is already saved above, so a failure here must never surface to the
    // child or block the form reset.
    fetch("/api/push/notify-withdrawal-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionId }),
    }).catch(() => {});
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="on-light space-y-3 rounded-2xl border-t-4 border-t-teal-600 bg-surface p-4 text-foreground shadow-lg"
    >
      <div className="flex items-center gap-2">
        <span className="rounded-lg bg-teal-500/15 p-2 text-teal-600">
          <HandCoins className="h-4 w-4" aria-hidden />
        </span>
        <h3 className="font-medium">{t("title")}</h3>
      </div>
      <div className="space-y-2">
        <input
          placeholder={t("whatFor")}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="input w-full"
        />
        <div className="flex gap-2">
          <input
            required
            type="number"
            step="0.01"
            min="0.01"
            max={available}
            placeholder="₪"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input w-24"
          />
          <button type="submit" disabled={busy} className="btn-primary flex-1">
            {t("sendRequest")}
          </button>
        </div>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </form>
  );
}
