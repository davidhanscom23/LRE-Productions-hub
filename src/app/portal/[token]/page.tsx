import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchPortalByToken, fetchPortalState, TOKEN_RE } from "@/lib/av-portals/server";
import { formatEventDate, showFileNumber } from "@/lib/av-portals/emails";
import { PortalClient } from "@/components/av-portal/portal-client";

type Props = { params: Promise<{ token: string }> };

// Private, link-only: never indexed.
export const metadata: Metadata = {
  title: "Your AV Event Portal | LRE Productions",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function EventPortalPage({ params }: Props) {
  const { token } = await params;
  if (!TOKEN_RE.test(token)) notFound();
  const portal = await fetchPortalByToken(token);
  if (!portal) notFound();

  if (!portal.is_active) {
    return (
      <main className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-xl font-semibold">This portal is no longer active</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Please contact your LRE Productions coordinator at hello@lreproductions.com.
        </p>
      </main>
    );
  }

  const { values, files } = await fetchPortalState(portal.id);
  return (
    <PortalClient
      token={token}
      show={{
        fileNo: showFileNumber(portal),
        eventName: portal.event_name,
        dateLabel: formatEventDate(portal.event_date),
        venue: portal.venue_name,
        loadInTime: portal.load_in_time,
        note: portal.note_to_client,
        clientName: portal.client_name,
      }}
      values={values as Record<string, unknown>}
      files={files.map((f) => ({ id: f.id, itemKey: f.item_key, fileName: f.file_name }))}
    />
  );
}
