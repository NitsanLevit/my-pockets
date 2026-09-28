import { createClient } from "@/lib/supabase/server";
import { redirect } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/logo/Logo";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { LanguageToggle } from "@/components/nav/LanguageToggle";
import { PushNotificationsToggle } from "@/components/push/PushNotificationsToggle";
import { Link } from "@/i18n/navigation";

export default async function FamilyLayout({
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
  if (!user) redirect({ href: "/login", locale });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, family_id")
    .eq("id", user!.id)
    .single();

  if (profile?.role !== "family_admin" || !profile.family_id) {
    redirect({ href: "/", locale });
  }

  const { data: membership } = await supabase
    .from("family_admins")
    .select("status")
    .eq("family_id", profile!.family_id!)
    .eq("user_id", user!.id)
    .single();

  if (membership?.status !== "active") {
    redirect({ href: "/pending-approval", locale });
  }

  const t = await getTranslations("nav");

  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
        <Logo withWordmark />
        <div className="flex items-center gap-2 sm:gap-3">
          <PushNotificationsToggle />
          <LanguageToggle />
          <SignOutButton />
        </div>
        <nav className="order-last flex w-full items-center gap-4 overflow-x-auto text-sm font-medium text-foreground/85 sm:order-0 sm:w-auto">
          <Link href="/dashboard" className="shrink-0 hover:text-foreground">
            {t("dashboard")}
          </Link>
          <Link href="/investments" className="shrink-0 hover:text-foreground">
            {t("investments")}
          </Link>
          <Link href="/requests" className="shrink-0 hover:text-foreground">
            {t("requests")}
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
