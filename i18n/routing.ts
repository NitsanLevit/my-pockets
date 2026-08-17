import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "he"],
  defaultLocale: "en",
  localePrefix: "always",
});

export type AppLocale = (typeof routing.locales)[number];

export const localeDirections: Record<AppLocale, "ltr" | "rtl"> = {
  en: "ltr",
  he: "rtl",
};
