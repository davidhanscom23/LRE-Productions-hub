"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/profile";
import {
  ensureReviewsSpreadsheet,
  linkReviewsSpreadsheet,
} from "@/lib/reviews/ensure-sheet";
import { syncExternalReviewsFromSheet } from "@/lib/reviews/sync-sheet";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function finishReviewsSheetSetup(input: {
  created: boolean;
  spreadsheetId: string | null;
  webViewLink: string | null;
}) {
  const supabase = await createClient();
  const sync = await syncExternalReviewsFromSheet({ writeClient: supabase });
  if (!sync.ok) {
    return {
      error:
        sync.error ??
        "Spreadsheet is linked, but sync failed. Try Sync website reviews.",
      created: input.created,
      spreadsheetId: input.spreadsheetId,
      webViewLink: input.webViewLink,
    };
  }

  revalidatePath("/client-reviews");
  revalidatePath("/hub-health");
  revalidatePath("/event-packets");

  return {
    error: null,
    created: input.created,
    spreadsheetId: input.spreadsheetId,
    webViewLink: input.webViewLink,
    pruned: sync.pruned,
    upserted: sync.upserted,
  };
}

export async function ensureReviewsSheetAction(): Promise<{
  error: string | null;
  created?: boolean;
  spreadsheetId?: string | null;
  webViewLink?: string | null;
  pruned?: number;
  upserted?: number;
}> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "You must be signed in." };
  if (profile.role !== "admin") {
    return { error: "Only admins can create the Client Reviews spreadsheet." };
  }

  const supabase = await createClient();
  const ensured = await ensureReviewsSpreadsheet({
    writeClient: supabase,
  });
  if (!ensured.ok) {
    return { error: ensured.error ?? "Could not create the reviews spreadsheet." };
  }

  return finishReviewsSheetSetup({
    created: ensured.created,
    spreadsheetId: ensured.spreadsheetId,
    webViewLink: ensured.webViewLink,
  });
}

export async function linkReviewsSheetAction(input: string): Promise<{
  error: string | null;
  created?: boolean;
  spreadsheetId?: string | null;
  webViewLink?: string | null;
  pruned?: number;
  upserted?: number;
}> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "You must be signed in." };
  if (profile.role !== "admin") {
    return { error: "Only admins can link the Client Reviews spreadsheet." };
  }

  const supabase = await createClient();
  const linked = await linkReviewsSpreadsheet(input, {
    writeClient: supabase,
  });
  if (!linked.ok) {
    return { error: linked.error ?? "Could not link the reviews spreadsheet." };
  }

  return finishReviewsSheetSetup({
    created: false,
    spreadsheetId: linked.spreadsheetId,
    webViewLink: linked.webViewLink,
  });
}

/** Admin: mark a private feedback response (from the review page) as followed up. */
export async function markPrivateFeedbackReviewedAction(
  formData: FormData,
): Promise<void> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") return;
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const supabase = createServiceClient();
  await supabase
    .from("private_review_feedback")
    .update({
      status: "reviewed",
      reviewed_at: new Date().toISOString(),
      reviewed_by: profile.id,
    })
    .eq("id", id);
  revalidatePath("/client-reviews");
}
