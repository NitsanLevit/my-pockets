import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { ActivityLog, type ActivityItem } from "@/components/activity/ActivityLog";

export default async function RequestsInboxPage() {
  const t = await getTranslations("nav");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("family_id")
    .eq("id", user!.id)
    .single();

  const { data: pending } = await supabase
    .from("transactions")
    .select("id, child_id, type, pocket_type, amount, status, description, created_at")
    .eq("family_id", profile!.family_id!)
    .eq("type", "withdrawal")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const childIds = [...new Set((pending ?? []).map((p) => p.child_id))];
  const { data: children } = childIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", childIds)
    : { data: [] };
  const nameByChild = new Map((children ?? []).map((c) => [c.id, c.display_name]));

  const items: ActivityItem[] = (pending ?? []).map((tx) => ({
    id: tx.id,
    type: tx.type,
    pocket_type: tx.pocket_type,
    amount: tx.amount,
    status: tx.status,
    description: tx.description,
    created_at: tx.created_at,
    childName: nameByChild.get(tx.child_id),
  }));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t("requests")}</h1>
      <div className="card">
        <ActivityLog items={items} canApprove />
      </div>
    </div>
  );
}
