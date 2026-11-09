"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  insertPacketMediaAction,
  nextPacketMediaSequenceAction,
} from "@/app/(app)/event-packets/actions";
import {
  getEventMediaStorageProviderAction,
  removeEventMediaObjectAction,
  uploadEventMediaObjectAction,
} from "@/app/(app)/event-media/storage-actions";
import { createClient } from "@/lib/supabase/client";
import { buildMediaFileName, extensionFromFileName } from "@/lib/event-packets/naming";
import {
  EVENT_MEDIA_FILE_ACCEPT,
  isAllowedEventMediaFile,
} from "@/lib/media/file-kind";
import { normalizeUploadFile } from "@/lib/media/normalize-upload-file";
import { uploadGridThumbnail } from "@/lib/media/upload-grid-thumbnail";
import type { MediaTagDraft } from "@/lib/types/event-packets";
import { mediaTypeFromFile } from "@/lib/types/event-media";

type PacketMediaUploadProps = {
  packetId: string;
  /** Always mirrored from Event details & recap. */
  recapTags: MediaTagDraft;
};

export function PacketMediaUpload({
  packetId,
  recapTags,
}: PacketMediaUploadProps) {
  const router = useRouter();
  const [files, setFiles] = useState<FileList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    fileName: string;
  } | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!files?.length) {
      setError("Choose at least one photo or video.");
      return;
    }
    if (
      !recapTags.location_name.trim() ||
      !recapTags.event_date ||
      !recapTags.dj_name.trim()
    ) {
      setError(
        "Fill Team member, venue, and date in Event details & recap first.",
      );
      return;
    }

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

    const seqResult = await nextPacketMediaSequenceAction(packetId);
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
            original.name.endsWith(".HEIC") || original.name.endsWith(".heic")
              ? `Converting ${original.name}…`
              : original.name,
        });
        const file = await normalizeUploadFile(original);
        const renamed = buildMediaFileName({
          locationName: recapTags.location_name,
          djName: recapTags.dj_name,
          eventDate: recapTags.event_date,
          sequence,
          extension: extensionFromFileName(file.name),
        });
        setProgress({
          current: i + 1,
          total: list.length,
          fileName: renamed,
        });

        const storage_path = `${user.id}/${packetId}/${renamed}`;
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
              cacheControl: "31536000",
              upsert: false,
              contentType: file.type || "application/octet-stream",
            });
          if (uploadError) throw new Error(uploadError.message);
        }

        const result = await insertPacketMediaAction({
          packet_id: packetId,
          storage_path,
          file_name: renamed,
          original_file_name: original.name,
          media_type: mediaTypeFromFile(file),
          sequence_number: sequence,
          dj_name: recapTags.dj_name,
          location_name: recapTags.location_name,
          event_date: recapTags.event_date,
          client_name: recapTags.client_name,
          event_type: recapTags.event_type,
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
        `Uploaded ${uploaded} file${uploaded === 1 ? "" : "s"} with auto tags and renamed files.`,
      );
      setFiles(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      setProgress(null);
    }
  }

  const inputClass =
    "h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm disabled:cursor-not-allowed disabled:opacity-80";

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5"
    >
      <div>
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          Photos &amp; videos
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Tags always match Event details & recap above — update the recap
          to change them. Files are renamed like the event folder and numbered
          so nothing overwrites. iPhone HEIC photos are accepted and converted
          to JPEG on upload (works in Chrome; falls back to server conversion
          if needed).
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Team member</span>
          <input
            value={recapTags.dj_name}
            className={inputClass}
            required
            readOnly
            disabled
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Location</span>
          <input
            value={recapTags.location_name}
            className={inputClass}
            required
            readOnly
            disabled
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Event date</span>
          <input
            type="date"
            value={recapTags.event_date}
            className={inputClass}
            required
            readOnly
            disabled
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Client</span>
          <input
            value={recapTags.client_name}
            className={inputClass}
            readOnly
            disabled
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium">Event type</span>
          <input
            value={recapTags.event_type}
            className={inputClass}
            readOnly
            disabled
          />
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Files</span>
        <input
          type="file"
          accept={EVENT_MEDIA_FILE_ACCEPT}
          multiple
          onChange={(event) => setFiles(event.target.files)}
          className="block w-full text-sm"
        />
      </label>

      {progress ? (
        <p className="text-sm text-[var(--muted)]">
          Uploading {progress.current}/{progress.total}: {progress.fileName}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}
      {success ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-300">
          {success}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={uploading}
        className="rounded-lg bg-[var(--brand)] px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {uploading ? "Uploading…" : "Upload media"}
      </button>
    </form>
  );
}
