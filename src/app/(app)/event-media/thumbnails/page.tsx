import { redirect } from "next/navigation";
import { ThumbnailBackfill } from "@/components/event-media/thumbnail-backfill";
import { getCurrentProfile } from "@/lib/auth/profile";

/**
 * Admin-only maintenance tool: generate grid thumbnails for event media
 * uploaded before thumbnails existed. Not linked in the sidebar on purpose.
 */
export default async function EventMediaThumbnailsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/");

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
          Event Media Thumbnails
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          One-time backfill: creates small gallery thumbnails for photos
          uploaded before thumbnails existed. New uploads make their own
          thumbnails automatically.
        </p>
      </div>
      <ThumbnailBackfill />
    </div>
  );
}
