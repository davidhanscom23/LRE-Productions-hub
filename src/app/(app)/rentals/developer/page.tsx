import { redirect } from "next/navigation";
import { DeveloperClient } from "@/components/av-erp/developer-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import { listIntegrationTokens } from "@/lib/av-erp/terminal-tokens";
import { createClient } from "@/lib/supabase/server";
import { canAccessAv } from "@/lib/av-access";

export const metadata = { title: "Developer and API — LRE AV" };

export default async function AvDeveloperPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessAv(profile)) redirect("/rentals");

  const supabase = await createClient();
  let tokens: Awaited<ReturnType<typeof listIntegrationTokens>> = [];
  let loadError: string | null = null;
  try {
    tokens = await listIntegrationTokens(supabase);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Unknown error";
  }

  return <DeveloperClient tokens={tokens} loadError={loadError} />;
}
