"use client";

import { FormEvent, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addPlanMarkerAction,
  deletePlanMarkerAction,
  deleteRoomPhotoAction,
  deleteVenueRenderAction,
  generateVenuePlanRenderAction,
  setVenueRenderStatusAction,
  uploadRoomPhotoAction,
} from "@/app/(app)/rentals/quotes/venue-plan-actions";
import type {
  AvOpportunityAttachment,
  AvOpportunityLine,
  AvOpportunityPlanMarker,
  AvOpportunityRender,
} from "@/lib/av-erp/types";

const fieldClass =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm";

export type RoomPhotoView = AvOpportunityAttachment & { url: string | null };
export type RenderView = AvOpportunityRender & { url: string | null };

type Props = {
  opportunityId: string;
  roomPhotos: RoomPhotoView[];
  planMarkers: AvOpportunityPlanMarker[];
  renders: RenderView[];
  lines: AvOpportunityLine[];
  loadError: string | null;
  geminiConfigured: boolean;
};

export function VenuePlanPanel({
  opportunityId,
  roomPhotos,
  planMarkers,
  renders,
  lines,
  loadError,
  geminiConfigured,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [activePhotoId, setActivePhotoId] = useState(
    roomPhotos[0]?.id ?? "",
  );
  const [markerLabel, setMarkerLabel] = useState("");
  const [pendingClick, setPendingClick] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [prompt, setPrompt] = useState(
    "Draw the listed AV gear into this room naturally.",
  );
  const imgRef = useRef<HTMLImageElement | null>(null);

  const activePhoto =
    roomPhotos.find((p) => p.id === activePhotoId) ?? roomPhotos[0] ?? null;
  const markersForPhoto = planMarkers.filter(
    (m) => m.attachment_id === (activePhoto?.id ?? ""),
  );
  const freeTextLines = lines.filter((l) => !l.product_id && !l.service_id);

  function run(
    action: () => Promise<{ ok: true } | { ok: false; error: string }>,
    okMessage?: string,
  ) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (okMessage) setMessage(okMessage);
      setPendingClick(null);
      router.refresh();
    });
  }

  function onPhotoClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (!activePhoto || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    setPendingClick({ x, y });
  }

  function onUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("opportunity_id", opportunityId);
    run(() => uploadRoomPhotoAction(fd), "Room photo uploaded.");
    e.currentTarget.reset();
  }

  function placeMarker(e: FormEvent) {
    e.preventDefault();
    if (!activePhoto || !pendingClick) return;
    const fd = new FormData();
    fd.set("opportunity_id", opportunityId);
    fd.set("attachment_id", activePhoto.id);
    fd.set("label", markerLabel || "Gear");
    fd.set("x", String(pendingClick.x));
    fd.set("y", String(pendingClick.y));
    run(async () => {
      const result = await addPlanMarkerAction(fd);
      if (result.ok) setMarkerLabel("");
      return result;
    }, "Marker placed.");
  }

  return (
    <section className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h2 className="text-sm font-semibold text-[var(--foreground)]">
        Venue plan
      </h2>
      <p className="mt-0.5 text-xs text-[var(--muted)]">
        Upload a room photo, click to place gear markers, then generate an AI
        layout render (KM venue plan).
      </p>

      {loadError ? (
        <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          Venue plan needs migration 149. ({loadError})
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-100">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100">
          {message}
        </p>
      ) : null}

      <form onSubmit={onUpload} className="mt-3 flex flex-wrap items-end gap-2">
        <label className="block text-sm">
          <span className="mb-1 block text-[var(--muted)]">Room photo</span>
          <input
            type="file"
            name="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            required
            className="block text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="h-9 rounded-lg border border-[var(--border)] px-3 text-sm disabled:opacity-50"
        >
          Upload
        </button>
      </form>

      {roomPhotos.length > 1 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {roomPhotos.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setActivePhotoId(p.id);
                setPendingClick(null);
              }}
              className={`rounded-lg border px-2 py-1 text-xs ${
                activePhoto?.id === p.id
                  ? "border-[var(--brand)] text-[var(--foreground)]"
                  : "border-[var(--border)] text-[var(--muted)]"
              }`}
            >
              {p.file_name || "Photo"}
            </button>
          ))}
        </div>
      ) : null}

      {activePhoto?.url ? (
        <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_16rem]">
          <div>
            <button
              type="button"
              onClick={onPhotoClick}
              className="relative block w-full overflow-hidden rounded-lg border border-[var(--border)] text-left"
              aria-label="Click photo to place a marker"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                src={activePhoto.url}
                alt={activePhoto.file_name || "Room photo"}
                className="max-h-[28rem] w-full object-contain bg-[var(--background)]"
              />
              {markersForPhoto.map((m) => (
                <span
                  key={m.id}
                  title={m.label}
                  className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[var(--brand)] shadow"
                  style={{
                    left: `${Number(m.x) * 100}%`,
                    top: `${Number(m.y) * 100}%`,
                  }}
                />
              ))}
              {pendingClick ? (
                <span
                  className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-amber-500 shadow"
                  style={{
                    left: `${pendingClick.x * 100}%`,
                    top: `${pendingClick.y * 100}%`,
                  }}
                />
              ) : null}
            </button>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Click the photo to set a marker position, then name it.
            </p>
            {pendingClick ? (
              <form
                onSubmit={placeMarker}
                className="mt-2 flex flex-wrap items-end gap-2"
              >
                <label className="block min-w-[12rem] flex-1 text-sm">
                  <span className="mb-1 block text-[var(--muted)]">Label</span>
                  <input
                    value={markerLabel}
                    onChange={(e) => setMarkerLabel(e.target.value)}
                    placeholder="Wireless mic"
                    list="venue-plan-line-labels"
                    className={fieldClass}
                    required
                  />
                  <datalist id="venue-plan-line-labels">
                    {lines.map((l) => (
                      <option key={l.id} value={l.description} />
                    ))}
                  </datalist>
                </label>
                <button
                  type="submit"
                  disabled={pending}
                  className="h-9 rounded-lg bg-[var(--brand)] px-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Place marker
                </button>
              </form>
            ) : null}
            <button
              type="button"
              disabled={pending}
              className="mt-2 text-xs text-red-700 dark:text-red-300 disabled:opacity-50"
              onClick={() => {
                const fd = new FormData();
                fd.set("opportunity_id", opportunityId);
                fd.set("id", activePhoto.id);
                run(() => deleteRoomPhotoAction(fd), "Photo removed.");
              }}
            >
              Remove this photo
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Markers
              </h3>
              {markersForPhoto.length === 0 ? (
                <p className="mt-1 text-sm text-[var(--muted)]">None yet.</p>
              ) : (
                <ul className="mt-1 space-y-1 text-sm">
                  {markersForPhoto.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center justify-between gap-2"
                    >
                      <span>{m.label}</span>
                      <button
                        type="button"
                        disabled={pending}
                        className="text-xs text-red-700 dark:text-red-300"
                        onClick={() => {
                          const fd = new FormData();
                          fd.set("opportunity_id", opportunityId);
                          fd.set("id", m.id);
                          run(() => deletePlanMarkerAction(fd));
                        }}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!activePhoto) return;
                const fd = new FormData();
                fd.set("opportunity_id", opportunityId);
                fd.set("attachment_id", activePhoto.id);
                fd.set("prompt", prompt);
                run(
                  () => generateVenuePlanRenderAction(fd),
                  "Render ready.",
                );
              }}
              className="space-y-2 border-t border-[var(--border)] pt-3"
            >
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                AI render
              </h3>
              {!geminiConfigured ? (
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  GEMINI_API_KEY is not set — markers still save; AI render is
                  unavailable until the key is configured.
                </p>
              ) : null}
              <label className="block text-sm">
                <span className="mb-1 block text-[var(--muted)]">Prompt</span>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={3}
                  className={fieldClass}
                />
              </label>
              {freeTextLines.length > 0 ? (
                <p className="text-xs text-[var(--muted)]">
                  Tip: free-text lines on this estimate can become marker labels.
                </p>
              ) : null}
              <button
                type="submit"
                disabled={pending || !geminiConfigured}
                className="h-9 rounded-lg bg-[var(--brand)] px-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {pending ? "Generating…" : "Generate render"}
              </button>
            </form>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-[var(--muted)]">
          No room photo yet. Upload one to place markers.
        </p>
      )}

      {renders.length > 0 ? (
        <div className="mt-4 border-t border-[var(--border)] pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Renders
          </h3>
          <ul className="mt-2 grid gap-3 sm:grid-cols-2">
            {renders.map((r) => (
              <li
                key={r.id}
                className="rounded-lg border border-[var(--border)] p-2"
              >
                {r.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.url}
                    alt={r.prompt || "Render"}
                    className="mb-2 max-h-48 w-full rounded object-contain bg-[var(--background)]"
                  />
                ) : (
                  <p className="mb-2 text-sm text-[var(--muted)]">
                    {r.status === "pending"
                      ? "Generating…"
                      : r.status === "failed"
                        ? r.error_message || "Failed"
                        : "No image yet"}
                  </p>
                )}
                <p className="text-xs text-[var(--muted)]">
                  {r.status}
                  {r.prompt ? ` · ${r.prompt.slice(0, 80)}` : ""}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {r.status === "ready" || r.status === "rejected" ? (
                    <button
                      type="button"
                      disabled={pending}
                      className="rounded border border-[var(--border)] px-2 py-0.5 text-xs"
                      onClick={() => {
                        const fd = new FormData();
                        fd.set("opportunity_id", opportunityId);
                        fd.set("id", r.id);
                        fd.set("status", "approved");
                        run(() => setVenueRenderStatusAction(fd));
                      }}
                    >
                      Approve
                    </button>
                  ) : null}
                  {r.status === "ready" || r.status === "approved" ? (
                    <button
                      type="button"
                      disabled={pending}
                      className="rounded border border-[var(--border)] px-2 py-0.5 text-xs"
                      onClick={() => {
                        const fd = new FormData();
                        fd.set("opportunity_id", opportunityId);
                        fd.set("id", r.id);
                        fd.set("status", "rejected");
                        run(() => setVenueRenderStatusAction(fd));
                      }}
                    >
                      Reject
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={pending}
                    className="rounded px-2 py-0.5 text-xs text-red-700 dark:text-red-300"
                    onClick={() => {
                      const fd = new FormData();
                      fd.set("opportunity_id", opportunityId);
                      fd.set("id", r.id);
                      run(() => deleteVenueRenderAction(fd));
                    }}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
