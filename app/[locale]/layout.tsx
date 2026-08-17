import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing, localeDirections, type AppLocale } from "@/i18n/routing";
import "../globals.css";

const appFont = Heebo({
  subsets: ["latin", "hebrew"],
  variable: "--font-app",
  display: "swap",
});

export const metadata: Metadata = {
  title: "My Pockets — Where kids learn to grow their money",
  description:
    "A financial education platform where kids track virtual money across Spend, Savings, and Investment pockets while parents manage the real funds.",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  const dir = localeDirections[locale as AppLocale];

  return (
    <html lang={locale} dir={dir} className={appFont.variable}>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
