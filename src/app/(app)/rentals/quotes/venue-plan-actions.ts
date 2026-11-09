"use server";

import { revalidatePath } from "next/cache";
import { requireAvErpAccess } from "@/lib/av-erp/access";
import { isGeminiConfigured } from "@/lib/gemini/credentials";
import { generateNanoBananaProImage } from "@/lib/gemini/nano-banana";

export type AvActionResult = { ok: true } | { ok: false; error: string };

const BUCKET = "av-opportunity-media";
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function revalidateQuote(id: string) {
  revalidatePath("/rentals/quotes");
  revalidatePath(`/rentals/quotes/${id}`);
}

function extensionForMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes("png")) return "png";
  if (m.includes("webp")) return "webp";
  if (m.includes("gif")) return "gif";
  return "jpg";
}

export async function uploadRoomPhotoAction(
  formData: FormData,
): Promise<AvActionResult> {
  const { supabase, profile, error } = await requireAvErpAccess();
  if (error || !profile) return { ok: false, error: error ?? "Unauthorized" };

  const opportunityId = str(formData, "opportunity_id");
  if (!opportunityId) return { ok: false, error: "Missing estimate." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a room photo to upload." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "Photo is too large (max 12 MB)." };
  }
  const contentType = file.type || "image/jpeg";
  if (!contentType.startsWith("image/")) {
    return { ok: false, error: "Upload an image file (JPEG, PNG, WebP)." };
  }

  const ext = extensionForMime(contentType);
  const storagePath = `${opportunityId}/room/${crypto.randomUUID()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, bytes, {
      contentType,
      cacheControl: "31536000",
      upsert: false,
    });
  if (uploadError) return { ok: false, error: uploadError.message };

  const { error: insertError } = await supabase
    .from("av_opportunity_attachments")
    .insert({
      opportunity_id: opportunityId,
      kind: "room_photo",
      storage_path: storagePath,
      file_name: file.name || `room.${ext}`,
      content_type: contentType,
      created_by: profile.id,
    });
  if (insertError) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    return { ok: false, error: insertError.message };
  }

  revalidateQuote(opportunityId);
  return { ok: true };
}

export async function deleteRoomPhotoAction(
  formData: FormData,
): Promise<AvActionResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };

  const opportunityId = str(formData, "opportunity_id");
  const id = str(formData, "id");
  if (!opportunityId || !id) return { ok: false, error: "Missing photo." };

  const { data: row } = await supabase
    .from("av_opportunity_attachments")
    .select("storage_path")
    .eq("id", id)
    .eq("opportunity_id", opportunityId)
    .maybeSingle();
  if (!row) return { ok: false, error: "Photo not found." };

  await supabase.from("av_opportunity_plan_markers").delete().eq("attachment_id", id);
  const { error: delError } = await supabase
    .from("av_opportunity_attachments")
    .delete()
    .eq("id", id);
  if (delError) return { ok: false, error: delError.message };
  await supabase.storage.from(BUCKET).remove([row.storage_path as string]);

  revalidateQuote(opportunityId);
  return { ok: true };
}

export async function addPlanMarkerAction(
  formData: FormData,
): Promise<AvActionResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };

  const opportunityId = str(formData, "opportunity_id");
  const attachmentId = str(formData, "attachment_id");
  const label = str(formData, "label");
  const x = Number(str(formData, "x"));
  const y = Number(str(formData, "y"));
  const lineId = str(formData, "line_id") || null;

  if (!opportunityId || !attachmentId) {
    return { ok: false, error: "Missing photo." };
  }
  if (!label || label.length > 120) {
    return { ok: false, error: "Label is required (max 120 characters)." };
  }
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) {
    return { ok: false, error: "Click on the photo to place a marker." };
  }

  const { error: insertError } = await supabase
    .from("av_opportunity_plan_markers")
    .insert({
      opportunity_id: opportunityId,
      attachment_id: attachmentId,
      line_id: lineId,
      label,
      x,
      y,
    });
  if (insertError) return { ok: false, error: insertError.message };

  revalidateQuote(opportunityId);
  return { ok: true };
}

export async function deletePlanMarkerAction(
  formData: FormData,
): Promise<AvActionResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };

  const opportunityId = str(formData, "opportunity_id");
  const id = str(formData, "id");
  if (!opportunityId || !id) return { ok: false, error: "Missing marker." };

  const { error: delError } = await supabase
    .from("av_opportunity_plan_markers")
    .delete()
    .eq("id", id)
    .eq("opportunity_id", opportunityId);
  if (delError) return { ok: false, error: delError.message };

  revalidateQuote(opportunityId);
  return { ok: true };
}

export async function generateVenuePlanRenderAction(
  formData: FormData,
): Promise<AvActionResult> {
  const { supabase, profile, error } = await requireAvErpAccess();
  if (error || !profile) return { ok: false, error: error ?? "Unauthorized" };

  const opportunityId = str(formData, "opportunity_id");
  const attachmentId = str(formData, "attachment_id");
  const prompt = str(formData, "prompt");
  if (!opportunityId || !attachmentId) {
    return { ok: false, error: "Pick a room photo first." };
  }
  if (prompt.length < 3) {
    return { ok: false, error: "Describe what to draw (at least a few words)." };
  }
  if (!isGeminiConfigured()) {
    return {
      ok: false,
      error:
        "AI renders need GEMINI_API_KEY. You can still place markers and upload a photo.",
    };
  }

  const { data: attachment } = await supabase
    .from("av_opportunity_attachments")
    .select("id, storage_path, content_type")
    .eq("id", attachmentId)
    .eq("opportunity_id", opportunityId)
    .maybeSingle();
  if (!attachment) return { ok: false, error: "Room photo not found." };

  const { data: markers } = await supabase
    .from("av_opportunity_plan_markers")
    .select("label, x, y")
    .eq("attachment_id", attachmentId)
    .eq("opportunity_id", opportunityId);

  const markerLines =
    (markers ?? [])
      .map(
        (m, i) =>
          `${i + 1}. "${m.label}" at about ${Math.round(Number(m.x) * 100)}% from left, ${Math.round(Number(m.y) * 100)}% from top`,
      )
      .join("\n") || "(no markers placed)";

  const fullPrompt = [
    "You are drawing a realistic venue AV layout render based on the attached room photo.",
    "Keep the room architecture, lighting, and camera angle. Place the described gear at the marker positions.",
    `Staff request: ${prompt}`,
    "Gear markers:",
    markerLines,
    "Do not add text overlays, watermarks, or UI chrome.",
  ].join("\n");

  const { data: pending, error: pendingError } = await supabase
    .from("av_opportunity_renders")
    .insert({
      opportunity_id: opportunityId,
      attachment_id: attachmentId,
      status: "pending",
      prompt,
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (pendingError || !pending) {
    return { ok: false, error: pendingError?.message ?? "Could not start render." };
  }

  try {
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(BUCKET)
      .download(attachment.storage_path as string);
    if (downloadError || !fileData) {
      throw new Error(downloadError?.message ?? "Could not load room photo.");
    }
    const refBytes = Buffer.from(await fileData.arrayBuffer());

    const generated = await generateNanoBananaProImage({
      prompt: fullPrompt,
      aspectRatio: "16:9",
      imageSize: "2K",
      referenceImage: {
        bytes: refBytes,
        mimeType: (attachment.content_type as string) || "image/jpeg",
      },
    });

    const storagePath = `${opportunityId}/renders/${pending.id}.${generated.extension}`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, generated.bytes, {
        contentType: generated.contentType,
        cacheControl: "31536000",
        upsert: false,
      });
    if (uploadError) throw new Error(uploadError.message);

    const { error: updateError } = await supabase
      .from("av_opportunity_renders")
      .update({
        status: "ready",
        storage_path: storagePath,
        error_message: "",
      })
      .eq("id", pending.id);
    if (updateError) throw new Error(updateError.message);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Render failed.";
    await supabase
      .from("av_opportunity_renders")
      .update({ status: "failed", error_message: message.slice(0, 500) })
      .eq("id", pending.id);
    revalidateQuote(opportunityId);
    return { ok: false, error: message };
  }

  revalidateQuote(opportunityId);
  return { ok: true };
}

export async function setVenueRenderStatusAction(
  formData: FormData,
): Promise<AvActionResult> {
  const { supabase, profile, error } = await requireAvErpAccess();
  if (error || !profile) return { ok: false, error: error ?? "Unauthorized" };

  const opportunityId = str(formData, "opportunity_id");
  const id = str(formData, "id");
  const status = str(formData, "status");
  if (!opportunityId || !id) return { ok: false, error: "Missing render." };
  if (!["approved", "rejected", "ready"].includes(status)) {
    return { ok: false, error: "Invalid status." };
  }

  const patch: Record<string, unknown> = { status };
  if (status === "approved") {
    patch.approved_by = profile.id;
    patch.approved_at = new Date().toISOString();
    patch.show_on_estimate = true;
  } else if (status === "rejected") {
    patch.approved_by = null;
    patch.approved_at = null;
    patch.show_on_estimate = false;
  }

  const { error: updateError } = await supabase
    .from("av_opportunity_renders")
    .update(patch)
    .eq("id", id)
    .eq("opportunity_id", opportunityId);
  if (updateError) return { ok: false, error: updateError.message };

  revalidateQuote(opportunityId);
  return { ok: true };
}

export async function deleteVenueRenderAction(
  formData: FormData,
): Promise<AvActionResult> {
  const { supabase, error } = await requireAvErpAccess();
  if (error) return { ok: false, error };

  const opportunityId = str(formData, "opportunity_id");
  const id = str(formData, "id");
  if (!opportunityId || !id) return { ok: false, error: "Missing render." };

  const { data: row } = await supabase
    .from("av_opportunity_renders")
    .select("storage_path")
    .eq("id", id)
    .eq("opportunity_id", opportunityId)
    .maybeSingle();
  if (!row) return { ok: false, error: "Render not found." };

  const { error: delError } = await supabase
    .from("av_opportunity_renders")
    .delete()
    .eq("id", id);
  if (delError) return { ok: false, error: delError.message };
  if (row.storage_path) {
    await supabase.storage.from(BUCKET).remove([row.storage_path as string]);
  }

  revalidateQuote(opportunityId);
  return { ok: true };
}
