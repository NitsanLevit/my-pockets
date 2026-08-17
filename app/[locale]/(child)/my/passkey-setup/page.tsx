import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { RegisterPasskeyButton } from "@/components/auth/RegisterPasskeyButton";
import { ScanFace } from "lucide-react";

export default async function PasskeySetupPage() {
  const t = await getTranslations("auth");

  return (
    <div className="flex flex-col items-center gap-6 py-12 text-center">
      <span className="rounded-full bg-brand-50 p-4 text-brand-600">
        <ScanFace className="h-10 w-10" aria-hidden />
      </span>
      <div className="max-w-sm space-y-2">
        <h1 className="text-xl font-semibold">{t("setUpPasskeyTitle")}</h1>
        <p className="text-foreground/78">{t("setUpPasskeyBody")}</p>
      </div>

      <RegisterPasskeyButton nextHref="/my" />

      <Link href="/my" className="text-sm text-foreground/72 hover:text-foreground/80">
        {t("skipForNow")}
      </Link>
    </div>
  );
}
