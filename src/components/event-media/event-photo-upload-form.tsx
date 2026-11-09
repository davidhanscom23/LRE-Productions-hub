"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  insertEventMediaAction,
  nextGenericMediaSequenceAction,
} from "@/app/(app)/submit-event-photos/actions";
import {
  getEventMediaStorageProviderAction,
  removeEventMediaObjectAction,
  uploadEventMediaObjectAction,
} from "@/app/(app)/event-media/storage-actions";
import { createClient } from "@/lib/supabase/client";
import {
  buildMediaFileName,
  extensionFromFileName,
} from "@/lib/event-packets/naming";
import {
  EVENT_MEDIA_FILE_ACCEPT,
  isAllowedEventMediaFile,
} from "@/lib/media/file-kind";
import { formatEventTypeLabel } from "@/lib/event-packets/format-event-type";
import { normalizeUploadFile } from "@/lib/media/normalize-upload-file";
import { uploadGridThumbnail } from "@/lib/media/upload-grid-thumbnail";
import { EVENT_TYPES, type EventType } from "@/lib/types/event-reports";
import { mediaTypeFromFile } from "@/lib/types/event-media";

const inputClass =
  "h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]";

type EventPhotoUploadFormProps = {
  defaultDjName?: string;
  venues?: { id: string; name: string }[];
};

export function EventPhotoUploadForm({
  defaultDjName = "",
  venues = [],
}: EventPhotoUploadFormProps) {
  const router = useRouter();
  const [locationName, setLocationName] = useState("");
  const [djName, setDjName] = useState(defaultDjName);
  const [clientName, setClientName] = useState("");
  const [eventType, setEventType] = useState<EventType | "">("");
  const [eventTypeOther, setEventTypeOther] = useState("");
  const [eventDate, setEventDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [files, setFiles] = useState<FileList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    fileName: string;
  } | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!locationName.trim()) {
      setError("Location / venue is required.");
      return;
    }
    if (!djName.trim()) {
      setError("Team member name is required.");
      return;
    }
    if (!eventDate) {
      setError("Event date is required.");
      return;
    }
    if (eventType === "Other" && !eventTypeOther.trim()) {
      setError("Describe the event type when Other is selected.");
      return;
    }
    if (!files || files.length === 0) {
      setError("Choose at least one photo or video.");
      return;
    }

    const mediaEventType = eventType
      ? formatEventTypeLabel({
          event_type: eventType,
          event_type_other: eventTypeOther,
        })
      : "";

    const list = Array.from(files);
    const invalid = list.find((file) => !isAllowedEventMediaFile(file));
    if (invalid) {
      setError(
        `“${invalid.name}” is not an image or video. JPEG, PNG, HEIC, and common video formats are accepted.`,
      );
      return;
    }

    setUploading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("You must be signed in.");
      setUploading(false);
      return;
    }

    const seqResult = await nextGenericMediaSequenceAction({
      location_name: locationName,
      dj_name: djName,
      event_date: eventDate,
    });
    let sequence = seqResult.sequence;
    let uploaded = 0;
    const { provider } = await getEventMediaStorageProviderAction();

    try {
      for (let i = 0; i < list.length; i++) {
        const original = list[i]!;
        setProgress({
          current: i + 1,
          total: list.length,
          fileName:
            /\.hei[cf]$/i.test(original.name)
              ? `Converting ${original.name}…`
              : original.name,
        });
        const file = await normalizeUploadFile(original);
        const renamed = buildMediaFileName({
          locationName,
          djName,
          eventDate,
          sequence,
          extension: extensionFromFileName(file.name),
        });
        setProgress({
          current: i + 1,
          total: list.length,
          fileName: renamed,
        });

        const storage_path = `${user.id}/generic/${crypto.randomUUID()}-${renamed}`;
        let storageProvider: "supabase" | "bunny" = "supabase";

        if (provider === "bunny") {
          const formData = new FormData();
          formData.set("path", storage_path);
          formData.set("file", file);
          const uploadResult = await uploadEventMediaObjectAction(formData);
          if (uploadResult.error) throw new Error(uploadResult.error);
          storageProvider = uploadResult.provider ?? "bunny";
        } else {
          const { error: uploadError } = await supabase.storage
            .from("event-media")
            .upload(storage_path, file, {
              upsert: false,
              contentType: file.type || "application/octet-stream",
              cacheControl: "31536000",
            });
          if (uploadError) throw new Error(uploadError.message);
        }

        const result = await insertEventMediaAction({
          event_name: locationName,
          event_date: eventDate,
          storage_path,
          file_name: renamed,
          original_file_name: original.name,
          media_type: mediaTypeFromFile(file),
          dj_name: djName,
          location_name: locationName,
          client_name: clientName,
          event_type: mediaEventType,
          sequence_number: sequence,
          storage_provider: storageProvider,
        });

        if (result.error) {
          await removeEventMediaObjectAction(storage_path, storageProvider);
          throw new Error(result.error);
        }

        if (storageProvider === "supabase" && mediaTypeFromFile(file) === "image") {
          await uploadGridThumbnail(supabase, storage_path, file);
        }

        uploaded += 1;
        sequence += 1;
      }

      setSuccess(
        `Uploaded ${uploaded} file${uploaded === 1 ? "" : "s"} with tags and renamed files.`,
      );
      setFiles(null);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Upload failed. Please try again.",
      );
    } finally {
      setUploading(false);
      setProgress(null);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 md:p-6"
    >
      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100">
          {success}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100">
          {error}
        </div>
      )}

      <p className="text-sm text-[var(--muted)]">
        Tags are applied automatically and are editable below. Files are renamed
        like Event Packets: Location - Team member - Date - 01.jpg under the venue folder.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5 sm:col-span-2">
          <span className="text-sm font-medium text-[var(--foreground)]">
            Location / venue
          </span>
          <input
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
            required
            list="generic-venues"
            className={inputClass}
            placeholder="e.g. The Treasury on the Plaza"
            disabled={uploading}
          />
          <datalist id="generic-venues">
            {venues.map((venue) => (
              <option key={venue.id} value={venue.name} />
            ))}
          </datalist>
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-[var(--foreground)]">
            Team member
          </span>
          <input
            value={djName}
            onChange={(e) => setDjName(e.target.value)}
            required
            className={inputClass}
            disabled={uploading}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-[var(--foreground)]">
            Event date
          </span>
          <input
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            required
            className={inputClass}
            disabled={uploading}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-[var(--foreground)]">
            Client
          </span>
          <input
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            className={inputClass}
            disabled={uploading}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-[var(--foreground)]">
            Event type
          </span>
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value as EventType | "")}
            className={inputClass}
            disabled={uploading}
          >
            <option value="">Select…</option>
            {EVENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        {eventType === "Other" ? (
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-sm font-medium text-[var(--foreground)]">
              Describe this event type
            </span>
            <input
              value={eventTypeOther}
              onChange={(e) => setEventTypeOther(e.target.value)}
              required
              className={inputClass}
              placeholder="e.g. Quinceañera, Fundraiser, Private party"
              disabled={uploading}
            />
          </label>
        ) : null}
      </div>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-[var(--foreground)]">
          Photos & videos
        </span>
        <input
          type="file"
          accept={EVENT_MEDIA_FILE_ACCEPT}
          multiple
          disabled={uploading}
          onChange={(e) => setFiles(e.target.files)}
          className="block w-full text-sm text-[var(--muted)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--brand-soft)] file:px-3 file:py-2 file:text-sm file:font-medium file:text-[var(--brand)]"
        />
        <span className="block text-xs text-[var(--muted)]">
          JPEG, PNG, HEIC, and common video formats are accepted. HEIC converts
          to JPEG on upload.
        </span>
      </label>

      {progress && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--muted)]">
          Uploading {progress.current} of {progress.total}:{" "}
          <span className="font-medium text-[var(--foreground)]">
            {progress.fileName}
          </span>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-hover)]">
            <div
              className="h-full rounded-full bg-[var(--brand)] transition-all"
              style={{
                width: `${Math.round((progress.current / progress.total) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={uploading}
          className="inline-flex h-10 items-center rounded-lg bg-[var(--brand)] px-5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {uploading ? "Uploading…" : "Upload media"}
        </button>
      </div>
    </form>
  );
}
