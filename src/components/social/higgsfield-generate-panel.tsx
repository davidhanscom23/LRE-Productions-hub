"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import {
  pollHiggsfieldPacketImageAction,
  saveHiggsfieldPacketImageAction,
  submitHiggsfieldPacketImageAction,
} from "@/app/(app)/social-studio/higgsfield-actions";
import {
  DEFAULT_STUDIO_IMAGE_MODEL,
  STUDIO_IMAGE_MODELS,
  type StudioImageAspectRatio,
  type StudioImageModelId,
} from "@/lib/social/image-gen-models";

type HiggsfieldGeneratePanelProps = {
  packetId: string;
  geminiConfigured: boolean;
  higgsfieldConfigured: boolean;
  defaultModelId?: StudioImageModelId;
  eventHint?: string;
};

const SOCIAL_ASPECT_PRESETS: {
  value: StudioImageAspectRatio;
  label: string;
}[] = [
  { value: "4:5", label: "4:5 feed" },
  { value: "1:1", label: "1:1 square" },
  { value: "9:16", label: "9:16 story" },
  { value: "16:9", label: "16:9 landscape" },
  { value: "3:2", label: "3:2" },
  { value: "2:3", label: "2:3" },
  { value: "3:4", label: "3:4" },
  { value: "4:3", label: "4:3" },
  { value: "5:4", label: "5:4" },
  { value: "21:9", label: "21:9" },
];

export function HiggsfieldGeneratePanel({
  packetId,
  geminiConfigured,
  higgsfieldConfigured,
  defaultModelId = DEFAULT_STUDIO_IMAGE_MODEL,
  eventHint,
}: HiggsfieldGeneratePanelProps) {
  const router = useRouter();
  const [modelId, setModelId] = useState<StudioImageModelId>(defaultModelId);
  const [aspectRatio, setAspectRatio] = useState<StudioImageAspectRatio>("4:5");
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  const anyConfigured = geminiConfigured || higgsfieldConfigured;

  const model = useMemo(
    () => STUDIO_IMAGE_MODELS.find((row) => row.id === modelId) ?? null,
    [modelId],
  );

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

  async function handleGenerate() {
    setError(null);
    setMessage(null);
    setNotice(null);
    setPreviewUrl(null);
    setStatus(null);

    if (!anyConfigured) {
      setError(
        "No image provider configured. Set GEMINI_API_KEY (Nano Banana Pro) and/or HF_API_KEY + HF_API_SECRET (Higgsfield).",
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
      const submitted = await submitHiggsfieldPacketImageAction({
        packetId,
        prompt,
        modelId,
        aspectRatio,
      });
      if (submitted.error) {
        setError(submitted.error);
        return;
      }
      if (submitted.notice) setNotice(submitted.notice);

      // Gemini completes in one round-trip.
      if (submitted.provider === "gemini") {
        if (submitted.previewDataUrl) setPreviewUrl(submitted.previewDataUrl);
        setMessage(
          `Saved ${submitted.fileName ?? "image"} to this packet. It is ready for exports and Marketing Queue.`,
        );
        setStatus("completed");
        startTransition(() => {
          router.refresh();
        });
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
        const polled = await pollHiggsfieldPacketImageAction(submitted.requestId);
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
        setError(
          "Timed out waiting for Higgsfield. Check your Cloud dashboard.",
        );
        return;
      }

      setStatus("saving");
      const saved = await saveHiggsfieldPacketImageAction({
        packetId,
        imageUrl,
        prompt,
        modelId: submitted.modelId ?? modelId,
      });
      if (saved.error) {
        setError(saved.error);
        return;
      }

      setMessage(
        `Saved ${saved.fileName ?? "image"} to this packet. It is ready for exports and Marketing Queue.`,
      );
      setStatus("completed");
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setBusy(false);
    }
  }

  const working = busy || pending;

  return (
    <section className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-lg bg-[var(--brand-soft)] p-2 text-[var(--brand)]">
          <Wand2 className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Generate image (admins)
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Default is Google Nano Banana Pro (Gemini). Higgsfield Cloud models
            remain available as fallbacks. Generated stills attach to this packet
            for Social Studio crops and Marketing Queue. Provider API usage is
            billed by Google / Higgsfield — website unlimited toggles do not apply.
          </p>
          {eventHint ? (
            <p className="mt-1 text-xs text-[var(--muted)]">Event: {eventHint}</p>
          ) : null}
        </div>
      </div>

      {!geminiConfigured ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          Nano Banana Pro needs <code className="text-xs">GEMINI_API_KEY</code>{" "}
          from{" "}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            Google AI Studio
          </a>{" "}
          (paid tier / billing required for{" "}
          <code className="text-xs">gemini-3-pro-image-preview</code>). Without
          it, generation falls back to Higgsfield when configured.
        </p>
      ) : null}

      {!higgsfieldConfigured && !geminiConfigured ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          Set <code className="text-xs">GEMINI_API_KEY</code> and/or{" "}
          <code className="text-xs">HF_API_KEY</code> +{" "}
          <code className="text-xs">HF_API_SECRET</code> in Vercel and
          .env.local, then redeploy.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
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
          {model ? (
            <span className="mt-1 block text-xs text-[var(--muted)]">
              {model.description}
            </span>
          ) : null}
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
            {(
              model?.aspectRatios ?? SOCIAL_ASPECT_PRESETS.map((row) => row.value)
            ).map((value) => {
              const preset = SOCIAL_ASPECT_PRESETS.find(
                (row) => row.value === value,
              );
              return (
                <option key={value} value={value}>
                  {preset?.label ?? value}
                </option>
              );
            })}
          </select>
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Prompt</span>
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          rows={4}
          disabled={working || !anyConfigured}
          placeholder="e.g. Candid photo of a wedding dance floor at golden hour, warm practical lights, shallow depth of field, no logos, no text"
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
          {working ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {working ? "Generating…" : "Generate & save to packet"}
        </button>
        {status ? (
          <span className="text-xs text-[var(--muted)]">Status: {status}</span>
        ) : null}
      </div>

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
      {previewUrl ? (
        <img
          src={previewUrl}
          alt="Generated image preview"
          className="max-h-72 w-full rounded-lg border border-[var(--border)] object-contain bg-[var(--background)]"
        />
      ) : null}
    </section>
  );
}
