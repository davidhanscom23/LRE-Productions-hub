import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CancelClient } from "@/components/scheduling/cancel-client";
import { COMPANY } from "@/lib/company";
import { createServiceClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { CANCEL_TOKEN_RE, whenText } from "@/lib/scheduling/server";

type Props = { params: Promise<{ token: string }> };

export const metadata: Metadata = { title: `Cancel booking | ${COMPANY.displayName}`, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function CancelPage({ params }: Props) {
  const { token } = await params;
  if (!CANCEL_TOKEN_RE.test(token) || !isServiceRoleConfigured()) notFound();
  const { data: b } = await createServiceClient()
    .from("meeting_bookings")
    .select("start_at, status, meeting_types:meeting_type_id ( timezone )")
    .eq("cancel_token", token)
    .maybeSingle();
  if (!b) notFound();
  const mt = Array.isArray(b.meeting_types) ? b.meeting_types[0] : b.meeting_types;
  const tz = (mt as { timezone?: string } | null)?.timezone ?? "America/New_York";
  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900">
      <main className="mx-auto max-w-xl px-4 py-8">
        <p className="text-xs uppercase tracking-wide text-neutral-500">{COMPANY.displayName}</p>
        <h1 className="mb-4 text-2xl font-semibold">Your booking</h1>
        <CancelClient token={token} when={whenText(b.start_at as string, tz)} alreadyCancelled={b.status === "cancelled"} />
      </main>
    </div>
  );
}
