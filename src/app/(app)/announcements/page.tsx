import { AnnouncementsClient } from "@/components/announcements/announcements-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import type { Announcement } from "@/lib/types/announcements";
import { redirect } from "next/navigation";

export default async function AnnouncementsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role === "guest") redirect("/");

  const canManage = profile.role === "admin" || profile.role === "trainer";
  const isAdmin = profile.role === "admin";

  const supabase = await createClient();
  const { data: annRows, error } = await supabase
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
        <p className="font-semibold">Announcements needs a database update</p>
        <p className="mt-2">
          Run migration <code>058_announcements.sql</code> in Supabase, then
          refresh. ({error.message})
        </p>
      </div>
    );
  }

  const rows = (annRows ?? []) as Announcement[];
  const authorIds = Array.from(new Set(rows.map((a) => a.created_by).filter(Boolean)));
  const { data: authors } = authorIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", authorIds)
    : { data: [] as { id: string; full_name: string }[] };
  const nameById = new Map(
    (authors ?? []).map((p) => [p.id as string, p.full_name as string]),
  );

  const { data: myAcks } = await supabase
    .from("announcement_acks")
    .select("announcement_id")
    .eq("user_id", profile.id);
  const myAckSet = new Set(
    (myAcks ?? []).map((r) => r.announcement_id as string),
  );

  const countByAnn = new Map<string, number>();
  if (isAdmin) {
    const { data: allAcks } = await supabase
      .from("announcement_acks")
      .select("announcement_id");
    for (const r of allAcks ?? []) {
      const id = r.announcement_id as string;
      countByAnn.set(id, (countByAnn.get(id) ?? 0) + 1);
    }
  }

  const announcements: Announcement[] = rows.map((a) => ({
    ...a,
    author_name: nameById.get(a.created_by) ?? "",
    acked: myAckSet.has(a.id),
    ack_count: isAdmin ? (countByAnn.get(a.id) ?? 0) : undefined,
  }));

  return (
    <AnnouncementsClient
      announcements={announcements}
      canManage={canManage}
      isAdmin={isAdmin}
    />
  );
}
