import { createClient } from "@/lib/supabase/server";
import { redirect } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/logo/Logo";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { LanguageToggle } from "@/components/nav/LanguageToggle";
import { Link } from "@/i18n/navigation";

export default async function ChildLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect({ href: "/login?as=kid", locale });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();

  if (profile?.role !== "child") redirect({ href: "/", locale });

  const t = await getTranslations("nav");

  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
        <Logo withWordmark />
        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageToggle />
          <SignOutButton redirectTo="/login?as=kid" />
        </div>
        <nav className="order-last flex w-full items-center gap-4 text-sm font-medium text-foreground/85 sm:order-0 sm:w-auto">
          <Link href="/my" className="shrink-0 hover:text-foreground">
            {t("dashboard")}
          </Link>
          <Link href="/my/investments" className="shrink-0 hover:text-foreground">
            {t("investments")}
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
