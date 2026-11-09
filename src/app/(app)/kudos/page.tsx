import { KudosClient } from "@/components/kudos/kudos-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import type { StaffOption } from "@/lib/types/action-items";
import type { Kudo } from "@/lib/types/kudos";
import { redirect } from "next/navigation";

export default async function KudosPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role === "guest") redirect("/");

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("kudos")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
        <p className="font-semibold">Kudos needs a database update</p>
        <p className="mt-2">
          Run migration <code>059_kudos.sql</code> in Supabase, then refresh. (
          {error.message})
        </p>
      </div>
    );
  }

  const { data: staff } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("is_active", true)
    .order("full_name", { ascending: true });
  const staffOptions: StaffOption[] = (staff ?? [])
    .filter((s) => (s.full_name as string)?.trim())
    .map((s) => ({ id: s.id as string, full_name: s.full_name as string }));
  const nameById = new Map(staffOptions.map((s) => [s.id, s.full_name]));

  const kudos: Kudo[] = ((rows ?? []) as Kudo[]).map((k) => ({
    ...k,
    from_name: nameById.get(k.from_user) ?? "Someone",
    to_name: nameById.get(k.to_user) ?? "Someone",
  }));

  return (
    <KudosClient
      currentUserId={profile.id}
      isAdmin={profile.role === "admin"}
      kudos={kudos}
      staff={staffOptions}
    />
  );
}
