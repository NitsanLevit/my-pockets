"use client";

import { useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import { useTranslations } from "next-intl";
import { Fingerprint } from "lucide-react";
import { useRouter } from "@/i18n/navigation";

export function RegisterPasskeyButton({ nextHref }: { nextHref: string }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setBusy(true);
    setError(null);
    try {
      const optionsRes = await fetch("/api/webauthn/register-options");
      if (!optionsRes.ok) throw new Error("Could not start passkey setup");
      const optionsJSON = await optionsRes.json();

      const attestation = await startRegistration({ optionsJSON });

      const verifyRes = await fetch("/api/webauthn/register-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(attestation),
      });
      if (!verifyRes.ok) {
        const { error: message } = await verifyRes.json();
        throw new Error(message ?? "Could not save passkey");
      }

      router.push(nextHref);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={handleClick}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 font-medium text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-60"
      >
        <Fingerprint className="h-5 w-5" aria-hidden />
        {t("setUpPasskeyAction")}
      </button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
