"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, HardDrive, ListPlus, Save, Sparkles } from "lucide-react";
import {
  generateCaptionsForPacketAction,
  saveCaptionsForPacketAction,
  signedMediaUrlAction,
  syncPacketToDriveAction,
} from "@/app/(app)/social-studio/actions";
import { queuePacketForMarketingAction } from "@/app/(app)/marketing/actions";
import { isImageMediaItem } from "@/lib/media/file-kind";
import { resolveDisplayableImageUrl } from "@/lib/media/resolve-preview-url";
import {
  SOCIAL_PLATFORM_LABELS,
  SOCIAL_PLATFORMS,
  type SocialPlatform,
} from "@/lib/social/platforms";
import { HiggsfieldGeneratePanel } from "@/components/social/higgsfield-generate-panel";
import { ImageCropExportEditor } from "@/components/social/image-crop-export-editor";
import type { StudioImageModelId } from "@/lib/social/image-gen-models";

type MediaItem = {
  id: string;
  file_name: string;
  storage_path: string;
  media_type: string;
  drive_file_id: string | null;
  drive_synced_at: string | null;
};

type SocialPacketStudioClientProps = {
  packetId: string;
  title: string;
  subtitle: string;
  isAdmin: boolean;
  /** Admins and trainers can queue drafts into Marketing. */
  canQueueMarketing: boolean;
  packetCompleted: boolean;
  driveConfigured: boolean;
  geminiConfigured: boolean;
  higgsfieldConfigured: boolean;
  studioImageDefaultModelId: StudioImageModelId;
  socialConsent: boolean;
  socialConsentNotes: string;
  initialCaptions: Record<SocialPlatform, string>;
  media: MediaItem[];
};

export function SocialPacketStudioClient({
  packetId,
  title,
  subtitle,
  isAdmin,
  canQueueMarketing,
  packetCompleted,
  driveConfigured,
  geminiConfigured,
  higgsfieldConfigured,
  studioImageDefaultModelId,
  socialConsent,
  socialConsentNotes,
  initialCaptions,
  media,
}: SocialPacketStudioClientProps) {
  const router = useRouter();
  const [captions, setCaptions] = useState(initialCaptions);
  const [savedSnapshot, setSavedSnapshot] = useState(
    JSON.stringify(initialCaptions),
  );
  const [platform, setPlatform] = useState<SocialPlatform>("instagram");
  const [selectedMediaId, setSelectedMediaId] = useState("");
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const dirty = JSON.stringify(captions) !== savedSnapshot;

  const images = useMemo(
    () => media.filter((item) => isImageMediaItem(item)),
    [media],
  );

  const selected = images.find((item) => item.id === selectedMediaId) ?? images[0];

  useEffect(() => {
    let cancelled = false;
    const objectUrls: string[] = [];

    async function loadThumbs() {
      const next: Record<string, string> = {};
      await Promise.all(
        images.map(async (item) => {
          try {
            const result = await signedMediaUrlAction(item.storage_path);
            if (result.error || !result.url) return;
            const displayUrl = await resolveDisplayableImageUrl({
              url: result.url,
              fileName: item.file_name,
            });
            if (cancelled) {
              if (displayUrl.startsWith("blob:")) URL.revokeObjectURL(displayUrl);
              return;
            }
            if (displayUrl.startsWith("blob:")) objectUrls.push(displayUrl);
            next[item.id] = displayUrl;
          } catch {
            // Thumbnails are best-effort; selected preview shows errors.
          }
        }),
      );
      if (!cancelled) setThumbUrls(next);
    }

    void loadThumbs();
    return () => {
      cancelled = true;
      for (const url of objectUrls) URL.revokeObjectURL(url);
    };
  }, [images]);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    async function loadSelectedPreview() {
      if (!selected) {
        setPreviewUrl(null);
        setPreviewLoading(false);
        return;
      }

      const cached = thumbUrls[selected.id];
      if (cached) {
        setPreviewUrl(cached);
        setPreviewLoading(false);
        return;
      }

      setPreviewLoading(true);
      try {
        const result = await signedMediaUrlAction(selected.storage_path);
        if (result.error || !result.url) {
          throw new Error(result.error ?? "Could not load image.");
        }
        const displayUrl = await resolveDisplayableImageUrl({
          url: result.url,
          fileName: selected.file_name,
        });
        if (displayUrl.startsWith("blob:")) objectUrl = displayUrl;
        if (!cancelled) setPreviewUrl(displayUrl);
      } catch (err) {
        if (!cancelled) {
          setPreviewUrl(null);
          setError(err instanceof Error ? err.message : "Could not load preview.");
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }

    void loadSelectedPreview();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [selected, thumbUrls]);

  function handleGenerate() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await generateCaptionsForPacketAction(packetId);
      if (result.error || !result.captions) {
        setError(result.error ?? "Generation failed.");
        return;
      }
      setCaptions(result.captions);
      setSavedSnapshot(JSON.stringify(result.captions));
      setMessage("Captions generated for all platforms (including YouTube).");
      router.refresh();
    });
  }

  function handleSaveCaptions() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await saveCaptionsForPacketAction(packetId, captions);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSavedSnapshot(JSON.stringify(captions));
      setMessage("Caption edits saved.");
      router.refresh();
    });
  }

  function handleDriveSync(force = false) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await syncPacketToDriveAction(packetId, { force });
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage(
        `Drive backup: uploaded ${result.uploaded ?? 0}, skipped ${result.skipped ?? 0}.`,
      );
      router.refresh();
    });
  }

  function handleQueueMarketing() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await queuePacketForMarketingAction(packetId, {
        scheduleInHours: 24,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      const created = result.created ?? 0;
      const updated = result.updated ?? 0;
      setMessage(
        created > 0
          ? `Queued ${created} platform draft(s) to Marketing (~24h schedule)${
              updated > 0 ? ` · filled ${updated} caption(s)` : ""
            }.`
          : updated > 0
            ? `Drafts already queued — filled ${updated} empty caption(s) from Social Studio.`
            : "All platforms were already in the Marketing Queue for this packet.",
      );
      router.refresh();
    });
  }

  async function handleCopy() {
    const text = captions[platform] ?? "";
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <Link
          href="/social-studio"
          className="text-sm font-medium text-[var(--brand)] hover:underline"
        >
          ← Social Studio
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
          {title}
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p>
      </div>

      {socialConsent ? (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100">
          <p className="font-semibold">Social consent on file</p>
          {socialConsentNotes ? (
            <p className="mt-1 text-emerald-900/90 dark:text-emerald-100/90">
              {socialConsentNotes}
            </p>
          ) : (
            <p className="mt-1 text-emerald-900/90 dark:text-emerald-100/90">
              Client approved social use of event media.
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-semibold">No social consent marked yet</p>
          <p className="mt-1">
            You can still draft captions and exports. Do not post publicly until
            consent is recorded on the Event Packet.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" />
          {pending ? "Working…" : "Generate captions"}
        </button>
        <button
          type="button"
          onClick={handleSaveCaptions}
          disabled={pending || !dirty}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium hover:bg-[var(--surface-hover)] disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          Save caption edits
        </button>
        <button
          type="button"
          onClick={() => handleDriveSync(false)}
          disabled={pending || !driveConfigured}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium hover:bg-[var(--surface-hover)] disabled:opacity-50"
          title={
            driveConfigured
              ? "Mirror new files in this packet’s folder tree to Google Drive"
              : "Configure GOOGLE_* env vars first"
          }
        >
          <HardDrive className="h-4 w-4" />
          Backup to Drive
        </button>
        {canQueueMarketing ? (
          <button
            type="button"
            onClick={handleQueueMarketing}
            disabled={pending || !packetCompleted}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium hover:bg-[var(--surface-hover)] disabled:opacity-50"
            title={
              packetCompleted
                ? "Create Marketing Queue drafts for all platforms including YouTube (~24h schedule)"
                : "Only completed packets can be queued"
            }
          >
            <ListPlus className="h-4 w-4" />
            Queue to Marketing
          </button>
        ) : null}
        {canQueueMarketing ? (
          <Link
            href="/marketing"
            className="inline-flex items-center rounded-lg px-2 py-2 text-sm font-medium text-[var(--brand)] hover:underline"
          >
            Open Marketing Queue
          </Link>
        ) : null}
        {isAdmin && driveConfigured ? (
          <button
            type="button"
            onClick={() => handleDriveSync(true)}
            disabled={pending}
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)] hover:bg-[var(--surface-hover)] disabled:opacity-50"
          >
            Force re-upload
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          {message}
        </p>
      ) : null}

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
        <div className="flex flex-wrap gap-2">
          {SOCIAL_PLATFORMS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setPlatform(item)}
              className={[
                "rounded-lg px-3 py-1.5 text-sm font-medium",
                platform === item
                  ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                  : "text-[var(--muted)] hover:bg-[var(--surface-hover)]",
              ].join(" ")}
            >
              {SOCIAL_PLATFORM_LABELS[item]}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[var(--foreground)]">
              {SOCIAL_PLATFORM_LABELS[platform]} caption
            </h2>
            <button
              type="button"
              onClick={handleCopy}
              disabled={!captions[platform]}
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--surface-hover)] disabled:opacity-50"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <textarea
            value={captions[platform] ?? ""}
            onChange={(event) =>
              setCaptions((prev) => ({
                ...prev,
                [platform]: event.target.value,
              }))
            }
            rows={12}
            placeholder="Generate captions to fill this platform…"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm leading-relaxed"
          />
        </div>
      </section>

      {isAdmin ? (
        <HiggsfieldGeneratePanel
          packetId={packetId}
          geminiConfigured={geminiConfigured}
          higgsfieldConfigured={higgsfieldConfigured}
          defaultModelId={studioImageDefaultModelId}
          eventHint={subtitle}
        />
      ) : null}

      <section className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Image exports
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Pick a packet photo, drag to reframe, and zoom for each network
            size. Download the crop, or save it back to the packet so Marketing
            Queue can post that framing. Videos are not cropped here — use the
            originals. HEIC uploads are converted to JPEG automatically.
          </p>
        </div>

        {images.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            No images on this packet yet.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {images.map((item) => {
                const thumb = thumbUrls[item.id];
                const isSelected = selected?.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setError(null);
                      setMessage(null);
                      setSelectedMediaId(item.id);
                    }}
                    className={[
                      "overflow-hidden rounded-lg border text-left transition",
                      isSelected
                        ? "border-[var(--brand)] ring-2 ring-[var(--brand)]/40"
                        : "border-[var(--border)] hover:border-[var(--brand)]/50",
                    ].join(" ")}
                  >
                    <div className="relative aspect-square bg-[var(--background)]">
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumb}
                          alt={item.file_name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center px-2 text-center text-[11px] text-[var(--muted)]">
                          Loading preview…
                        </div>
                      )}
                    </div>
                    <div className="truncate px-2 py-1.5 text-[11px] text-[var(--muted)]">
                      {item.file_name}
                      {item.drive_file_id ? " · Drive" : ""}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-medium text-[var(--foreground)]">
                Selected: {selected?.file_name ?? "—"}
              </p>
              {previewLoading ? (
                <span className="text-xs text-[var(--muted)]">Loading…</span>
              ) : null}
            </div>

            <ImageCropExportEditor
              key={selected?.id ?? "none"}
              packetId={packetId}
              sourceUrl={previewUrl}
              fileName={selected?.file_name ?? "export"}
              onSaved={(text) => {
                setError(null);
                setMessage(text);
                router.refresh();
              }}
              onError={(text) => {
                setMessage(null);
                setError(text);
              }}
            />
          </>
        )}
      </section>
    </div>
  );
}
