import { ContentSlaClient } from "@/components/content-sla/content-sla-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import { loadContentSlaBoard } from "@/lib/content-sla/board";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function ContentSlaPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin" && profile.role !== "trainer") {
    redirect("/");
  }

  const supabase = await createClient();
  const { rows, error } = await loadContentSlaBoard(supabase, { days: 21 });

  if (error) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
        <p className="font-semibold">Content SLA needs Event Packets</p>
        <p className="mt-2">{error}</p>
      </div>
    );
  }

  return <ContentSlaClient rows={rows} />;
}
