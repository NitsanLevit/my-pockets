"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/logo/Logo";
import { Link, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { PasswordInput } from "@/components/ui/PasswordInput";

export default function SignUpPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [familyName, setFamilyName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          app_signup: "family_admin",
          family_name: familyName,
          display_name: displayName,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setBusy(false);
      return;
    }

    if (data.session) {
      // Email confirmation is off — we already have a session, finish now.
      const { error: rpcError } = await supabase.rpc(
        "complete_family_admin_signup",
        { p_family_name: familyName, p_display_name: displayName }
      );
      if (rpcError) {
        setError(rpcError.message);
        setBusy(false);
        return;
      }
      router.push("/pending-approval");
      router.refresh();
      return;
    }

    router.push("/pending-approval?confirmEmail=1");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-12 sm:px-6">
      <Logo withWordmark />
      <form
        onSubmit={handleSubmit}
        className="on-light w-full max-w-sm space-y-4 rounded-2xl bg-surface p-6 text-foreground shadow-lg"
      >
        <h1 className="text-xl font-semibold">{t("signUp")}</h1>

        <Field label={t("familyName")}>
          <input
            required
            value={familyName}
            onChange={(e) => setFamilyName(e.target.value)}
            className="input"
          />
        </Field>
        <Field label={t("yourName")}>
          <input
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="input"
          />
        </Field>
        <Field label={t("email")}>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
          />
        </Field>
        <Field label={t("password")}>
          <PasswordInput
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>

        {error && <p className="text-sm text-danger">{error}</p>}

        <button type="submit" disabled={busy} className="btn-primary w-full">
          {t("signUp")}
        </button>

        <p className="text-center text-sm text-foreground/78">
          <Link href="/login" className="text-brand-600 hover:text-brand-700">
            {t("signIn")}
          </Link>
        </p>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium text-foreground/80">{label}</span>
      {children}
    </label>
  );
}
