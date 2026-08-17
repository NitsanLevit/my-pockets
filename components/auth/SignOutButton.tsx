"use client";

import { useTranslations } from "next-intl";
import { LogOut } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton({
  className,
  redirectTo = "/login",
}: {
  className?: string;
  redirectTo?: string;
}) {
  const t = useTranslations("nav");
  const router = useRouter();

  async function handleClick() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <button
      onClick={handleClick}
      className={className ?? "btn-secondary shrink-0 px-3 xs:px-5"}
    >
      <LogOut className="h-4 w-4 shrink-0" aria-hidden />
      <span className="hidden xs:inline">{t("signOut")}</span>
    </button>
  );
}
