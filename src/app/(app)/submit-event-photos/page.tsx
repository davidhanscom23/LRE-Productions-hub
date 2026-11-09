import { EventMediaGallery } from "@/components/event-media/event-media-gallery";
import { EventPhotoUploadForm } from "@/components/event-media/event-photo-upload-form";
import { getCurrentProfile } from "@/lib/auth/profile";
import {
  getEventMediaAccessUrl,
  getEventMediaThumbAccessUrl,
} from "@/lib/storage/event-media";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type {
  EventMedia,
  EventMediaUploader,
} from "@/lib/types/event-media";

type MediaRow = Omit<EventMedia, "uploader" | "signed_url"> & {
  uploader: EventMediaUploader | EventMediaUploader[] | null;
};

const GALLERY_LIMIT = 120;

export default async function SubmitEventPhotosPage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  const isAdmin = profile.role === "admin";

  const select = `
      id,
      uploader_id,
      event_name,
      event_date,
      storage_path,
      storage_provider,
      file_name,
      media_type,
      created_at,
      folder_path,
      location_name,
      dj_name,
      client_name,
      uploader:profiles!event_media_uploader_id_fkey (
        id,
        full_name,
        email,
        avatar_url
      )
    `;

  // Staff/trainers: own uploads only. Admins: full gallery (capped).
  let withProvider = supabase
    .from("event_media")
    .select(select)
    .order("event_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(GALLERY_LIMIT);
  if (!isAdmin) {
    withProvider = withProvider.eq("uploader_id", profile.id);
  }
  const withProviderRes = await withProvider;

  let rows: MediaRow[] = [];
  if (withProviderRes.error?.message?.includes("storage_provider")) {
    let legacy = supabase
      .from("event_media")
      .select(
        `
        id,
        uploader_id,
        event_name,
        event_date,
        storage_path,
        file_name,
        media_type,
        created_at,
        folder_path,
        location_name,
        dj_name,
        client_name,
        uploader:profiles!event_media_uploader_id_fkey (
          id,
          full_name,
          email,
          avatar_url
        )
      `,
      )
      .order("event_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(GALLERY_LIMIT);
    if (!isAdmin) {
      legacy = legacy.eq("uploader_id", profile.id);
    }
    const legacyRes = await legacy;
    if (legacyRes.error) {
      return (
        <div className="mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100">
          Couldn’t load event media: {legacyRes.error.message}
        </div>
      );
    }
    rows = (legacyRes.data ?? []) as MediaRow[];
  } else if (withProviderRes.error) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100">
        Couldn’t load event media: {withProviderRes.error.message}
      </div>
    );
  } else {
    rows = (withProviderRes.data ?? []) as MediaRow[];
  }

  const { data: venues } = await supabase
    .from("venues")
    .select("id, name")
    .order("name", { ascending: true });

  const items: EventMedia[] = await Promise.all(
    rows.map(async (row) => {
      const provider =
        row.storage_provider === "bunny" || row.storage_provider === "supabase"
          ? row.storage_provider
          : "supabase";
      const [access, thumb] = await Promise.all([
        getEventMediaAccessUrl({
          supabase,
          path: row.storage_path,
          provider,
          expiresIn: 3600,
        }),
        getEventMediaThumbAccessUrl({
          supabase,
          path: row.storage_path,
          provider,
          expiresIn: 86400,
        }),
      ]);
      return {
        ...row,
        storage_provider: provider,
        uploader: Array.isArray(row.uploader)
          ? (row.uploader[0] ?? null)
          : row.uploader,
        signed_url: access.url,
        thumb_url: thumb.url,
      };
    }),
  );

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
          Submit Event Photos
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Generic uploader for one-offs. Prefer Event Packets when the job came
          from the calendar so wrap-up and media stay linked.
        </p>
      </div>

      <EventPhotoUploadForm
        defaultDjName={profile.full_name ?? ""}
        venues={(venues ?? []) as { id: string; name: string }[]}
      />

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">
            Gallery
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {isAdmin
              ? "All uploads, grouped by event folder, newest first."
              : "Your uploads, grouped by event folder, newest first."}
          </p>
        </div>
        <EventMediaGallery
          items={items}
          currentUserId={profile.id}
          isAdmin={isAdmin}
        />
      </section>
    </div>
  );
}
