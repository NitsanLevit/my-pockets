"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/logo/Logo";
import { Link, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { PasskeyLoginButton } from "@/components/auth/PasskeyLoginButton";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [role, setRole] = useState<"family" | "child">(
    searchParams.get("as") === "kid" ? "child" : "family"
  );
  const [mode, setMode] = useState<"password" | "magicLink">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [childPassword, setChildPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "no_account"
      ? "That session had no account attached — sign up first, or sign in with an existing account's password."
      : null
  );
  const [linkSent, setLinkSent] = useState(false);

  function switchRole(next: "family" | "child") {
    setRole(next);
    setError(null);
    setLinkSent(false);
  }

  async function handleFamilySubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();

    if (mode === "password") {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setError(signInError.message);
        setBusy(false);
        return;
      }
      router.push("/");
      router.refresh();
      return;
    }

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        // Magic link here is a *sign-in* shortcut for existing family admins,
        // not a signup path — without this, an unrecognized email silently
        // creates a bare auth user with no profile/family, leaving them
        // stuck authenticated-but-unauthorized with no way to complete setup.
        shouldCreateUser: false,
      },
    });
    setBusy(false);
    if (otpError) {
      setError(
        otpError.message.includes("Signups not allowed")
          ? "No account found for this email — sign up first."
          : otpError.message
      );
      return;
    }
    setLinkSent(true);
  }

  async function handleChildSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();

    const { data: resolvedEmail, error: resolveError } = await supabase.rpc(
      "resolve_child_email",
      { p_username: username.toLowerCase() }
    );

    if (resolveError || !resolvedEmail) {
      setError("Username or password is incorrect");
      setBusy(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: resolvedEmail,
      password: childPassword,
    });
    setBusy(false);
    if (signInError) {
      setError("Username or password is incorrect");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-12 sm:px-6">
      <Logo withWordmark />
      <div className="on-light w-full max-w-sm space-y-4 rounded-2xl bg-surface p-6 text-foreground shadow-lg">
        <h1 className="text-xl font-semibold">{t("signIn")}</h1>

        <div className="flex gap-1 rounded-full border border-border p-1 text-xs sm:text-sm">
          <button
            type="button"
            onClick={() => switchRole("family")}
            className={`flex-1 whitespace-nowrap rounded-full px-2 py-1.5 ${role === "family" ? "bg-brand-600 text-white" : "text-foreground/85"}`}
          >
            {t("parentAdmin")}
          </button>
          <button
            type="button"
            onClick={() => switchRole("child")}
            className={`flex-1 whitespace-nowrap rounded-full px-2 py-1.5 ${role === "child" ? "bg-brand-600 text-white" : "text-foreground/85"}`}
          >
            {t("childLogin")}
          </button>
        </div>

        {role === "family" ? (
          <form onSubmit={handleFamilySubmit} className="space-y-4">
            <div className="flex gap-1 rounded-full border border-border p-1 text-xs sm:text-sm">
              <button
                type="button"
                onClick={() => setMode("password")}
                className={`flex-1 whitespace-nowrap rounded-full px-2 py-1.5 ${mode === "password" ? "bg-brand-600 text-white" : "text-foreground/85"}`}
              >
                {t("signInWithPassword")}
              </button>
              <button
                type="button"
                onClick={() => setMode("magicLink")}
                className={`flex-1 whitespace-nowrap rounded-full px-2 py-1.5 ${mode === "magicLink" ? "bg-brand-600 text-white" : "text-foreground/85"}`}
              >
                {t("sendMagicLink")}
              </button>
            </div>

            <label className="block space-y-1 text-sm">
              <span className="font-medium text-foreground/80">{t("email")}</span>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
              />
            </label>

            {mode === "password" && (
              <label className="block space-y-1 text-sm">
                <span className="font-medium text-foreground/80">{t("password")}</span>
                <input
                  required
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input"
                />
              </label>
            )}

            {linkSent && (
              <p className="text-sm text-success">{t("magicLinkSent")}</p>
            )}
            {error && <p className="text-sm text-danger">{error}</p>}

            <button type="submit" disabled={busy} className="btn-primary w-full">
              {mode === "password" ? t("signIn") : t("sendMagicLink")}
            </button>

            <p className="text-center text-sm text-foreground/78">
              <Link href="/signup" className="text-brand-600 hover:text-brand-700">
                {t("signUp")}
              </Link>
            </p>
          </form>
        ) : (
          <div className="space-y-4">
            <PasskeyLoginButton />

            <div className="flex items-center gap-3 text-xs text-foreground/65">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={handleChildSubmit} className="space-y-4">
              <label className="block space-y-1 text-sm">
                <span className="font-medium text-foreground/80">{t("username")}</span>
                <input
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input"
                  autoCapitalize="none"
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="font-medium text-foreground/80">{t("password")}</span>
                <input
                  required
                  type="password"
                  value={childPassword}
                  onChange={(e) => setChildPassword(e.target.value)}
                  className="input"
                />
              </label>

              {error && <p className="text-sm text-danger">{error}</p>}

              <button type="submit" disabled={busy} className="btn-primary w-full">
                {t("signIn")}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
