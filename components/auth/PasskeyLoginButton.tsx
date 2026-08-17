"use client";

import { useState } from "react";
import { startAuthentication } from "@simplewebauthn/browser";
import { useTranslations } from "next-intl";
import { ScanFace } from "lucide-react";
import { useRouter } from "@/i18n/navigation";

export function PasskeyLoginButton() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setBusy(true);
    setError(null);
    try {
      const optionsRes = await fetch("/api/webauthn/auth-options");
      if (!optionsRes.ok) throw new Error("Could not start sign-in");
      const optionsJSON = await optionsRes.json();

      const assertion = await startAuthentication({ optionsJSON });

      const verifyRes = await fetch("/api/webauthn/auth-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(assertion),
      });
      if (!verifyRes.ok) {
        const { error: message } = await verifyRes.json();
        throw new Error(message ?? "Sign-in failed");
      }

      router.push("/");
      router.refresh();
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
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-brand-600 px-6 py-3 font-medium text-brand-600 transition-colors hover:bg-brand-50"
      >
        <ScanFace className="h-5 w-5" aria-hidden />
        {t("usePasskey")}
      </button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
