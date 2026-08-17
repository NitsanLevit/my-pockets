"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { UserPlus } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { DisclosureTrigger } from "@/components/ui/Disclosure";

export function AddChildForm({ familyId }: { familyId: string }) {
  const t = useTranslations("admin");
  const authT = useTranslations("auth");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const res = await fetch("/api/admin/children", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ familyId, displayName, username, password }),
    });

    setBusy(false);
    if (!res.ok) {
      const { error: message } = await res.json();
      setError(message ?? "Could not create account");
      return;
    }

    setDisplayName("");
    setUsername("");
    setPassword("");
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <DisclosureTrigger
        label={t("addChild")}
        icon={UserPlus}
        active={open}
        onClick={() => setOpen((v) => !v)}
      />
      {open && (
      <form onSubmit={handleSubmit} className="card grid gap-3 sm:grid-cols-4">
        <input
          required
          placeholder={authT("yourName")}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="input"
        />
        <input
          required
          placeholder={authT("username")}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="input"
        />
        <input
          required
          type="password"
          minLength={4}
          placeholder={authT("password")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input"
        />
        <div className="flex gap-2">
          <button type="submit" disabled={busy} className="btn-primary flex-1">
            {t("addChild")}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="btn-secondary"
          >
            ✕
          </button>
        </div>
        {error && (
          <p className="col-span-full text-sm text-danger">{error}</p>
        )}
      </form>
      )}
    </div>
  );
}
