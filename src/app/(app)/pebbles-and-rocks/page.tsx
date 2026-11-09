import { PebblesRocksClient } from "@/components/pebbles-and-rocks/pebbles-rocks-client";
import { isGuestRole } from "@/lib/auth/guest";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import type { QuarterlyGoal } from "@/lib/types/quarterly-goals";

export default async function PebblesAndRocksPage() {
  const supabase = await createClient();
  const current = await getCurrentProfile();
  const guest = isGuestRole(current?.role);
  const isAdmin = current?.role === "admin";

  const [peopleRes, goalsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, role, is_active")
      .eq("is_active", true),
    supabase
      .from("quarterly_goals")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  if (goalsRes.error) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
        <p className="font-semibold">Pebbles &amp; Rocks needs a database update</p>
        <p className="mt-2">
          Run migration <code>100_quarterly_goals.sql</code> in Supabase, then
          refresh.
        </p>
      </div>
    );
  }

  const people = (peopleRes.data ?? [])
    .filter((p) => p.role !== "guest" && (p.full_name as string)?.trim())
    .map((p) => ({ id: p.id as string, name: p.full_name as string }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const goals = (goalsRes.data ?? []) as QuarterlyGoal[];

  return (
    <PebblesRocksClient
      people={people}
      goals={goals}
      currentUserId={current?.id ?? ""}
      isAdmin={isAdmin}
      readOnly={guest}
      currentYear={new Date().getFullYear()}
    />
  );
}
