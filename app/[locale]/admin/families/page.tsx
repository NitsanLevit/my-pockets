import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { FamilyApprovalRow } from "@/components/admin/FamilyApprovalRow";

export default async function FamiliesApprovalPage() {
  const t = await getTranslations("admin");
  const supabase = await createClient();

  const { data: memberships } = await supabase
    .from("family_admins")
    .select("family_id, user_id, status, created_at")
    .order("created_at", { ascending: false });

  const familyIds = [...new Set((memberships ?? []).map((m) => m.family_id))];
  const userIds = [...new Set((memberships ?? []).map((m) => m.user_id))];

  const [{ data: families }, { data: profiles }] = await Promise.all([
    familyIds.length
      ? supabase.from("families").select("id, name").in("id", familyIds)
      : Promise.resolve({ data: [] }),
    userIds.length
      ? supabase.from("profiles").select("id, display_name").in("id", userIds)
      : Promise.resolve({ data: [] }),
  ]);

  const familyById = new Map((families ?? []).map((f) => [f.id, f.name]));
  const profileById = new Map(
    (profiles ?? []).map((p) => [p.id, p.display_name])
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t("approveFamilies")}</h1>

      <div className="space-y-3">
        {(memberships ?? []).map((m) => (
          <FamilyApprovalRow
            key={`${m.family_id}-${m.user_id}`}
            familyId={m.family_id}
            userId={m.user_id}
            familyName={familyById.get(m.family_id) ?? "—"}
            adminName={profileById.get(m.user_id) ?? "—"}
            status={m.status}
            createdAt={m.created_at}
          />
        ))}
        {memberships?.length === 0 && (
          <p className="text-sm text-foreground/78">{t("noFamiliesYet")}</p>
        )}
      </div>
    </div>
  );
}
