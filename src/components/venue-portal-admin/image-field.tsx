"use client";

import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { compressImageFile } from "@/lib/media/optimize-image";
import { normalizeUploadFile } from "@/lib/media/normalize-upload-file";

export function ImageField({
  label,
  value,
  onChange,
  folder,
}: {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
  folder: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      const normalized = await normalizeUploadFile(file);
      const small = await compressImageFile(normalized, { maxEdge: 1800, quality: 0.82 });
      const ext = small.type === "image/png" ? "png" : "jpg";
      const path = `${folder}/${crypto.randomUUID()}.${ext}`;
      const supabase = createClient();
      const { error } = await supabase.storage
        .from("venue-portal-images")
        .upload(path, small, { cacheControl: "31536000", contentType: small.type });
      if (error) throw new Error(error.message);
      const { data } = supabase.storage.from("venue-portal-images").getPublicUrl(path);
      onChange(data.publicUrl);
    } catch (e) {
      setErr(
        e instanceof Error
          ? e.message.includes("Bucket not found")
            ? "Run migration 136 in Supabase first."
            : e.message
          : "Upload failed",
      );
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <div className="text-sm">
      <span className="block">{label}</span>
      <div className="mt-1 flex items-center gap-3">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-14 w-20 rounded-md border border-[var(--border)] object-cover" />
        ) : (
          <div className="flex h-14 w-20 items-center justify-center rounded-md border border-dashed border-[var(--border)] text-[var(--muted-foreground)]">
            <ImagePlus className="h-5 w-5" />
          </div>
        )}
        <button type="button" disabled={busy} onClick={() => ref.current?.click()}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs">
          {busy ? "Uploading…" : value ? "Replace" : "Upload"}
        </button>
        {value && (
          <button type="button" onClick={() => onChange(null)} className="rounded-lg border border-[var(--border)] p-1.5" title="Remove">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      </div>
      {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
    </div>
  );
}
