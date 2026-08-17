import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/logo/Logo";
import { SignOutButton } from "@/components/auth/SignOutButton";

export default async function PendingApprovalPage({
  searchParams,
}: {
  searchParams: Promise<{ confirmEmail?: string }>;
}) {
  const { confirmEmail } = await searchParams;
  const t = await getTranslations("auth");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center sm:px-6">
      <Logo withWordmark />
      <div className="max-w-md space-y-4">
        <h1 className="text-xl font-semibold">
          {confirmEmail ? "Check your email" : t("pendingApproval")}
        </h1>
        <p className="text-foreground/85">
          {confirmEmail
            ? "We sent you a confirmation link — click it, then come back and sign in."
            : t("pendingApproval")}
        </p>
      </div>
      {!confirmEmail && <SignOutButton />}
    </div>
  );
}
