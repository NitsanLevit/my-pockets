import { createClient } from "@/lib/supabase/server";
import { redirect } from "@/i18n/navigation";
import { Logo } from "@/components/logo/Logo";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { LanguageToggle } from "@/components/nav/LanguageToggle";

export default async function AdminLayout({
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
    .select("role")
    .eq("id", user!.id)
    .single();

  if (profile?.role !== "super_admin") redirect({ href: "/", locale });

  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
        <Logo withWordmark />
        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageToggle />
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
