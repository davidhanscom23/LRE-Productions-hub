"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Download,
  FolderPlus,
  Loader2,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import {
  attachImageStudioToPacketAction,
  deleteStudioLibraryImageAction,
  generateImageStudioAction,
  getStudioLibraryAccessUrlAction,
  pollImageStudioHiggsfieldAction,
  saveImageStudioLibraryAction,
} from "@/app/(app)/image-studio/actions";
import {
  STUDIO_IMAGE_MODELS,
  type StudioImageAspectRatio,
  type StudioImageModelId,
} from "@/lib/social/image-gen-models";

export type ImageStudioLibraryItem = {
  id: string;
  prompt: string;
  model_id: string;
  provider: string;
  aspect_ratio: string;
  image_size: string | null;
  file_name: string;
  preview_url: string | null;
  created_at: string;
};

export type ImageStudioPacketOption = {
  id: string;
  label: string;
};

type SessionItem = {
  id: string;
  prompt: string;
  modelId: StudioImageModelId;
  aspectRatio: string;
  imageSize?: string;
  previewUrl: string;
  createdAt: string;
};

type ImageStudioClientProps = {
  geminiConfigured: boolean;
  higgsfieldConfigured: boolean;
  defaultModelId: StudioImageModelId;
  library: ImageStudioLibraryItem[];
  packets: ImageStudioPacketOption[];
  libraryReady: boolean;
  libraryError?: string | null;
};

const ASPECT_LABELS: Record<string, string> = {
  "4:5": "4:5 feed",
  "1:1": "1:1 square",
  "9:16": "9:16 story",
  "16:9": "16:9 landscape",
};

export function ImageStudioClient({
  geminiConfigured,
  higgsfieldConfigured,
  defaultModelId,
  library,
  packets,
  libraryReady,
  libraryError,
}: ImageStudioClientProps) {
  const router = useRouter();
  const [modelId, setModelId] = useState<StudioImageModelId>(defaultModelId);
  const [aspectRatio, setAspectRatio] = useState<StudioImageAspectRatio>("4:5");
  const [imageSize, setImageSize] = useState<"1K" | "2K" | "4K">("2K");
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [activeMeta, setActiveMeta] = useState<{
    prompt: string;
    modelId: StudioImageModelId;
    aspectRatio: string;
    imageSize?: string;
    imageDataUrl?: string;
    imageUrl?: string;
  } | null>(null);
  const [session, setSession] = useState<SessionItem[]>([]);
  const [packetId, setPacketId] = useState(packets[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();

  const anyConfigured = geminiConfigured || higgsfieldConfigured;
  const model = useMemo(
    () => STUDIO_IMAGE_MODELS.find((row) => row.id === modelId) ?? null,
    [modelId],
  );
  const isGeminiModel = model?.provider === "gemini";

  function selectModel(nextId: StudioImageModelId) {
    setModelId(nextId);
    const nextModel = STUDIO_IMAGE_MODELS.find((row) => row.id === nextId);
    if (nextModel && !nextModel.aspectRatios.includes(aspectRatio)) {
      setAspectRatio(nextModel.defaultAspectRatio);
    }
  }

  async function sleep(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  function pushSession(item: Omit<SessionItem, "id" | "createdAt">) {
    const row: SessionItem = {
      ...item,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
    };
    setSession((prev) => [row, ...prev].slice(0, 24));
  }

  async function handleGenerate() {
    setError(null);
    setMessage(null);
    setNotice(null);
    setPreviewUrl(null);
    setActiveMeta(null);
    setStatus(null);

    if (!anyConfigured) {
      setError(
        "No image provider configured. Set GEMINI_API_KEY and/or HF_API_KEY + HF_API_SECRET.",
      );
      return;
    }
    if (prompt.trim().length < 3) {
      setError("Enter a prompt (at least a few words).");
      return;
    }

    setBusy(true);
    try {
      setStatus("generating");
      const submitted = await generateImageStudioAction({
        prompt,
        modelId,
        aspectRatio,
        imageSize: isGeminiModel ? imageSize : undefined,
      });
      if (submitted.error) {
        setError(submitted.error);
        return;
      }
      if (submitted.notice) setNotice(submitted.notice);

      if (submitted.provider === "gemini" && submitted.previewDataUrl) {
        setPreviewUrl(submitted.previewDataUrl);
        const meta = {
          prompt,
          modelId: submitted.modelId ?? modelId,
          aspectRatio: submitted.aspectRatio ?? aspectRatio,
          imageSize: submitted.imageSize,
          imageDataUrl: submitted.previewDataUrl,
        };
        setActiveMeta(meta);
        pushSession({
          prompt: meta.prompt,
          modelId: meta.modelId,
          aspectRatio: meta.aspectRatio,
          imageSize: meta.imageSize,
          previewUrl: submitted.previewDataUrl,
        });
        setStatus("completed");
        setMessage("Generation complete — preview below.");
        return;
      }

      if (!submitted.requestId) {
        setError("Could not start generation.");
        return;
      }

      setStatus("queued");
      let imageUrl: string | null = null;
      for (let attempt = 0; attempt < 90; attempt++) {
        await sleep(2000);
        const polled = await pollImageStudioHiggsfieldAction(
          submitted.requestId,
        );
        if (polled.error) {
          setError(polled.error);
          setStatus(polled.status ?? null);
          return;
        }
        setStatus(polled.status ?? "in_progress");
        if (polled.imageUrl) {
          imageUrl = polled.imageUrl;
          setPreviewUrl(polled.imageUrl);
        }
        if (polled.done) break;
      }

      if (!imageUrl) {
        setError("Timed out waiting for Higgsfield.");
        return;
      }

      const meta = {
        prompt,
        modelId: submitted.modelId ?? modelId,
        aspectRatio: submitted.aspectRatio ?? aspectRatio,
        imageUrl,
      };
      setActiveMeta(meta);
      pushSession({
        prompt: meta.prompt,
        modelId: meta.modelId,
        aspectRatio: meta.aspectRatio,
        previewUrl: imageUrl,
      });
      setStatus("completed");
      setMessage("Generation complete — preview below.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setBusy(false);
      setStatus((s) => (s === "completed" ? s : null));
    }
  }

  async function handleSaveLibrary() {
    if (!activeMeta) {
      setError("Generate an image first.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await saveImageStudioLibraryAction({
        prompt: activeMeta.prompt,
        modelId: activeMeta.modelId,
        aspectRatio: activeMeta.aspectRatio,
        imageSize: activeMeta.imageSize,
        imageDataUrl: activeMeta.imageDataUrl,
        imageUrl: activeMeta.imageUrl,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage(`Saved ${result.fileName ?? "image"} to the Hub library.`);
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  async function handleAttachPacket() {
    if (!activeMeta) {
      setError("Generate an image first.");
      return;
    }
    if (!packetId) {
      setError("Pick a packet to attach to.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await attachImageStudioToPacketAction({
        packetId,
        prompt: activeMeta.prompt,
        modelId: activeMeta.modelId,
        imageDataUrl: activeMeta.imageDataUrl,
        imageUrl: activeMeta.imageUrl,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage(
        `Attached ${result.fileName ?? "image"} to the packet. Open Social Studio to crop or queue.`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleAttachLibrary(libraryId: string) {
    if (!packetId) {
      setError("Pick a packet to attach to.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await attachImageStudioToPacketAction({
        packetId,
        prompt: "",
        libraryImageId: libraryId,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage(
        `Attached ${result.fileName ?? "library image"} to the packet.`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteLibrary(id: string) {
    setBusy(true);
    setError(null);
    try {
      const result = await deleteStudioLibraryImageAction(id);
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage("Removed from library.");
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  async function handleDownload(url: string, fileName: string) {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setError("Could not download image.");
    }
  }

  async function handleLibraryDownload(item: ImageStudioLibraryItem) {
    let url = item.preview_url;
    if (!url) {
      const access = await getStudioLibraryAccessUrlAction(item.id);
      if (access.error || !access.url) {
        setError(access.error ?? "Could not open library image.");
        return;
      }
      url = access.url;
    }
    await handleDownload(url, item.file_name || "image-studio.png");
  }

  const working = busy || pending;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-[var(--brand)]">
          <Wand2 className="h-5 w-5" />
          <p className="text-xs font-semibold tracking-[0.14em] uppercase">
            Admin only
          </p>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)] sm:text-3xl">
          Image Studio
        </h1>
        <p className="max-w-2xl text-sm text-[var(--muted)]">
          Generate stills with Nano Banana Pro (Gemini) or Higgsfield, download
          them, save into the Hub library for staff reuse, or push into a Social
          Studio packet. The in-packet generator on Social Studio is unchanged.
        </p>
      </header>

      {!geminiConfigured ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          Nano Banana Pro needs <code className="text-xs">GEMINI_API_KEY</code>.
          Without it, generation falls back to Higgsfield when configured.
        </p>
      ) : null}
      {!anyConfigured ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          Set <code className="text-xs">GEMINI_API_KEY</code> and/or{" "}
          <code className="text-xs">HF_API_KEY</code> +{" "}
          <code className="text-xs">HF_API_SECRET</code>, then redeploy.
        </p>
      ) : null}
      {!libraryReady && libraryError ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          Library needs migration <code className="text-xs">047_studio_images.sql</code>
          . Run it in the Supabase SQL editor, then refresh. ({libraryError})
        </p>
      ) : null}

      <section className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block text-sm sm:col-span-2 lg:col-span-1">
            <span className="mb-1 block font-medium">Model</span>
            <select
              value={modelId}
              onChange={(event) =>
                selectModel(event.target.value as StudioImageModelId)
              }
              disabled={working || !anyConfigured}
              className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm"
            >
              {STUDIO_IMAGE_MODELS.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.label}
                  {row.provider === "gemini" ? " (Gemini)" : " (Higgsfield)"}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Aspect ratio</span>
            <select
              value={aspectRatio}
              onChange={(event) =>
                setAspectRatio(event.target.value as StudioImageAspectRatio)
              }
              disabled={working || !anyConfigured}
              className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm"
            >
              {(model?.aspectRatios ?? ["4:5"]).map((value) => (
                <option key={value} value={value}>
                  {ASPECT_LABELS[value] ?? value}
                </option>
              ))}
            </select>
          </label>

          {isGeminiModel ? (
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Image size</span>
              <select
                value={imageSize}
                onChange={(event) =>
                  setImageSize(event.target.value as "1K" | "2K" | "4K")
                }
                disabled={working || !anyConfigured}
                className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm"
              >
                <option value="1K">1K</option>
                <option value="2K">2K</option>
                <option value="4K">4K</option>
              </select>
            </label>
          ) : (
            <div className="hidden text-sm text-[var(--muted)] lg:block">
              <span className="mb-1 block font-medium text-[var(--foreground)]">
                Image size
              </span>
              <p className="pt-2">Higgsfield uses its own resolution settings.</p>
            </div>
          )}
        </div>

        <label className="block text-sm">
          <span className="mb-1 block font-medium">Prompt</span>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={5}
            disabled={working || !anyConfigured}
            placeholder="e.g. Editorial photo of a corporate stage with warm amber uplights, shallow depth of field, no logos, no text"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm leading-relaxed disabled:opacity-60"
          />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={working || !anyConfigured}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {working && status !== "completed" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {working && status !== "completed" ? "Generating…" : "Generate"}
          </button>
          {status ? (
            <span className="text-xs text-[var(--muted)]">Status: {status}</span>
          ) : null}
        </div>
      </section>

      {notice ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          {notice}
        </p>
      ) : null}
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

      {previewUrl && activeMeta ? (
        <section className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Latest result
          </h2>
          <img
            src={previewUrl}
            alt="Generated preview"
            className="max-h-[28rem] w-full rounded-lg border border-[var(--border)] object-contain bg-[var(--background)]"
          />
          <p className="text-sm text-[var(--muted)]">{activeMeta.prompt}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                void handleDownload(
                  previewUrl,
                  `image-studio-${Date.now()}.png`,
                )
              }
              disabled={working}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium hover:bg-[var(--surface-hover)] disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Download
            </button>
            <button
              type="button"
              onClick={() => void handleSaveLibrary()}
              disabled={working || !libraryReady}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium hover:bg-[var(--surface-hover)] disabled:opacity-50"
              title={
                libraryReady
                  ? "Save into Hub library for staff reuse"
                  : "Run migration 047 first"
              }
            >
              <FolderPlus className="h-4 w-4" />
              Save to Hub library
            </button>
          </div>

          <div className="grid gap-3 border-t border-[var(--border)] pt-4 sm:grid-cols-[1fr_auto]">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">
                Push to Social Studio packet
              </span>
              <select
                value={packetId}
                onChange={(event) => setPacketId(event.target.value)}
                disabled={working || packets.length === 0}
                className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm"
              >
                {packets.length === 0 ? (
                  <option value="">No packets found</option>
                ) : (
                  packets.map((packet) => (
                    <option key={packet.id} value={packet.id}>
                      {packet.label}
                    </option>
                  ))
                )}
              </select>
            </label>
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={() => void handleAttachPacket()}
                disabled={working || !packetId}
                className="inline-flex h-10 items-center rounded-lg bg-[var(--brand)] px-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                Attach to packet
              </button>
              {packetId ? (
                <Link
                  href={`/social-studio/${packetId}`}
                  className="inline-flex h-10 items-center rounded-lg px-2 text-sm text-[var(--brand)] hover:underline"
                >
                  Open
                </Link>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <section className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          This session
        </h2>
        {session.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            Generations in this browser tab appear here for quick re-download.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {session.map((item) => (
              <li
                key={item.id}
                className="overflow-hidden rounded-lg border border-[var(--border)]"
              >
                <button
                  type="button"
                  className="block w-full text-left"
                  onClick={() => {
                    setPreviewUrl(item.previewUrl);
                    setActiveMeta({
                      prompt: item.prompt,
                      modelId: item.modelId,
                      aspectRatio: item.aspectRatio,
                      imageSize: item.imageSize,
                      imageDataUrl: item.previewUrl.startsWith("data:")
                        ? item.previewUrl
                        : undefined,
                      imageUrl: item.previewUrl.startsWith("http")
                        ? item.previewUrl
                        : undefined,
                    });
                  }}
                >
                  <img
                    src={item.previewUrl}
                    alt=""
                    className="aspect-square w-full object-cover bg-[var(--background)]"
                  />
                </button>
                <div className="space-y-2 p-3">
                  <p className="line-clamp-2 text-xs text-[var(--muted)]">
                    {item.prompt}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      void handleDownload(
                        item.previewUrl,
                        `image-studio-${item.id}.png`,
                      )
                    }
                    className="inline-flex items-center gap-1 text-xs font-medium text-[var(--brand)] hover:underline"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Re-download
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Hub library
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Saved stills for staff reuse. Attach any of them to a packet below.
            </p>
          </div>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Packet for attach</span>
            <select
              value={packetId}
              onChange={(event) => setPacketId(event.target.value)}
              disabled={working || packets.length === 0}
              className="h-10 min-w-[14rem] rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm"
            >
              {packets.length === 0 ? (
                <option value="">No packets found</option>
              ) : (
                packets.map((packet) => (
                  <option key={packet.id} value={packet.id}>
                    {packet.label}
                  </option>
                ))
              )}
            </select>
          </label>
        </div>

        {!libraryReady ? (
          <p className="text-sm text-[var(--muted)]">
            Library unavailable until migration 047 is applied.
          </p>
        ) : library.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            No saved images yet. Generate one and click Save to Hub library.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {library.map((item) => (
              <li
                key={item.id}
                className="overflow-hidden rounded-lg border border-[var(--border)]"
              >
                {item.preview_url ? (
                  <img
                    src={item.preview_url}
                    alt=""
                    className="aspect-square w-full object-cover bg-[var(--background)]"
                  />
                ) : (
                  <div className="flex aspect-square items-center justify-center bg-[var(--background)] text-xs text-[var(--muted)]">
                    No preview
                  </div>
                )}
                <div className="space-y-2 p-3">
                  <p className="line-clamp-2 text-xs text-[var(--muted)]">
                    {item.prompt || item.file_name}
                  </p>
                  <p className="text-[11px] text-[var(--muted)]">
                    {item.model_id} · {item.aspect_ratio}
                    {item.image_size ? ` · ${item.image_size}` : ""}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleLibraryDownload(item)}
                      disabled={working}
                      className="inline-flex items-center gap-1 text-xs font-medium text-[var(--brand)] hover:underline disabled:opacity-50"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleAttachLibrary(item.id)}
                      disabled={working || !packetId}
                      className="inline-flex items-center gap-1 text-xs font-medium text-[var(--brand)] hover:underline disabled:opacity-50"
                    >
                      Attach
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteLibrary(item.id)}
                      disabled={working}
                      className="inline-flex items-center gap-1 text-xs font-medium text-red-700 hover:underline disabled:opacity-50 dark:text-red-300"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
