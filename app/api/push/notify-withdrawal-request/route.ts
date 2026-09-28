import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { webpush } from "@/lib/webpush";
import type { PocketType } from "@/lib/supabase/types";

// Called by the child's browser right after `request_withdrawal` succeeds.
// Best-effort: the withdrawal request itself is already saved by that RPC,
// so failures here (missing VAPID keys, an expired subscription, a push
// service outage) must never surface as an error to the child.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const transactionId: string | undefined = body?.transactionId;
  if (!transactionId) {
    return NextResponse.json({ error: "Missing transactionId" }, { status: 400 });
  }

  // RLS-scoped: only succeeds if the caller can actually see this
  // transaction (their own, as the child, per transactions_select policy).
  const supabase = await createClient();
  const { data: txn } = await supabase
    .from("transactions")
    .select("child_id, family_id, pocket_type, amount, description")
    .eq("id", transactionId)
    .eq("type", "withdrawal")
    .eq("status", "pending")
    .single();

  if (!txn) {
    return NextResponse.json({ sent: 0 });
  }

  const admin = createAdminClient();
  const { data: child } = await admin
    .from("profiles")
    .select("display_name")
    .eq("id", txn.child_id)
    .single();

  const { data: familyAdmins } = await admin
    .from("family_admins")
    .select("user_id")
    .eq("family_id", txn.family_id)
    .eq("status", "active");

  const adminIds = (familyAdmins ?? []).map((a) => a.user_id);
  if (adminIds.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  const { data: adminProfiles } = await admin
    .from("profiles")
    .select("id, locale_pref")
    .in("id", adminIds);
  const localeByProfile = new Map((adminProfiles ?? []).map((p) => [p.id, p.locale_pref ?? "en"]));

  const { data: subscriptions } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth, profile_id")
    .in("profile_id", adminIds);

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  // Pulled into plain locals — TS narrowing of `txn` from the earlier
  // `if (!txn) return` guard doesn't carry into a closure defined below.
  const txnAmount = txn.amount;
  const txnPocketType = txn.pocket_type;
  const txnDescription = txn.description;
  const childName = child?.display_name ?? "";

  const payloadByLocale = new Map<string, string>();
  async function payloadFor(locale: string) {
    const cached = payloadByLocale.get(locale);
    if (cached) return cached;

    const [t, tPockets] = await Promise.all([
      getTranslations({ locale, namespace: "withdrawal" }),
      getTranslations({ locale, namespace: "pockets" }),
    ]);
    const values = {
      name: childName,
      currency: "₪",
      amount: Math.abs(txnAmount),
      pocket: tPockets(txnPocketType as PocketType),
    };
    const body = txnDescription
      ? t("notificationBodyWithNote", { ...values, note: txnDescription })
      : t("notificationBody", values);
    const payload = JSON.stringify({ title: t("notificationTitle"), body, url: "/requests" });
    payloadByLocale.set(locale, payload);
    return payload;
  }

  let sent = 0;
  await Promise.all(
    subscriptions.map(async (sub) => {
      const locale = localeByProfile.get(sub.profile_id) ?? "en";
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          await payloadFor(locale)
        );
        sent++;
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await admin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        }
      }
    })
  );

  return NextResponse.json({ sent });
}
