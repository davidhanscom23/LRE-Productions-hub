import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { loadPortalBundle, scrubSavings } from "@/lib/venue-portals/data";
import { QuoteWizard } from "@/components/venue-portal/quote-wizard";

type Props = { params: Promise<{ slug: string }> };

// Link-only: reachable by URL, never indexed.
const NO_INDEX = { index: false, follow: false } as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const loaded = await loadPortalBundle(slug);
  return {
    title: loaded
      ? `Instant AV Quote - ${loaded.bundle.portal.name}`
      : "Instant AV Quote",
    robots: NO_INDEX,
  };
}

export default async function QuotePortalPage({ params }: Props) {
  const { slug } = await params;
  const profile = await getCurrentProfile();
  const isAdmin = profile?.role === "admin";
  const loaded = await loadPortalBundle(slug, { includeUnpublished: isAdmin });
  if (!loaded) notFound();

  return (
    <>
      {!loaded.bundle.portal.isPublished && (
        <div className="bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-900">
          Admin preview: this page is not published yet. Only signed-in admins
          can see it, and submissions here do not send emails.
        </div>
      )}
      <QuoteWizard
        bundle={scrubSavings(loaded.bundle)}
        coordinatorGate={loaded.hasCoordinatorPassword}
      />
    </>
  );
}
