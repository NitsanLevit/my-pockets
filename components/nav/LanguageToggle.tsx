"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { Languages } from "lucide-react";

export function LanguageToggle() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  function switchTo(next: string) {
    router.replace(pathname, { locale: next });
  }

  return (
    <div className="on-light inline-flex shrink-0 items-center gap-1 rounded-full bg-surface p-1 text-sm shadow-md">
      <Languages className="mx-1.5 h-4 w-4 text-foreground/72" aria-hidden />
      {routing.locales.map((l) => (
        <button
          key={l}
          onClick={() => switchTo(l)}
          className={`rounded-full px-2.5 py-1 transition-colors ${
            l === locale
              ? "bg-brand-600 text-white"
              : "text-foreground/85 hover:bg-surface-muted"
          }`}
          aria-current={l === locale}
        >
          {l === "en" ? "EN" : "עב"}
        </button>
      ))}
    </div>
  );
}
