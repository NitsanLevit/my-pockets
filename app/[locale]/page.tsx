import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/logo/Logo";
import { LanguageToggle } from "@/components/nav/LanguageToggle";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { redirectForProfile } from "@/lib/auth/redirect-for-profile";
import { ensureFamilyAdminProfile } from "@/lib/auth/ensure-family-admin-profile";

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("common");
  const authT = await getTranslations("auth");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await ensureFamilyAdminProfile(supabase, user);
    await redirectForProfile(supabase, user.id, locale);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-6">
        <Logo withWordmark />
        <LanguageToggle />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 text-center sm:px-6">
        <div className="max-w-xl space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {t("appName")}
          </h1>
          <p className="text-lg text-foreground/85">{t("tagline")}</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="rounded-xl bg-brand-600 px-6 py-3 font-medium text-white shadow-sm transition-colors hover:bg-brand-700"
          >
            {authT("signUp")}
          </Link>
          <Link
            href="/login"
            className="on-light rounded-xl bg-surface px-6 py-3 font-medium text-foreground shadow-md transition-colors hover:bg-surface-muted"
          >
            {authT("signIn")}
          </Link>
        </div>

        <Link
          href="/login?as=kid"
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          {authT("childLogin")}
          <ArrowRight className="h-4 w-4 flip-rtl" aria-hidden />
        </Link>
      </main>
    </div>
  );
}
