"use server";

import { getCurrentProfile } from "@/lib/auth/profile";
import { rejectedProjectIds } from "@/lib/pipeline/payment-matching";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type Result = { error: string | null };

const UUID_RE = /^[0-9a-f-]{36}$/i;

async function requireAdmin() {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Sign in first." as const };
  if (profile.role !== "admin") {
    return { error: "Only admins can match payments to projects." as const };
  }
  return { error: null };
}

async function loadPayment(paymentId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pipeline_payments")
    .select("id, client_id, project_id, raw")
    .eq("id", paymentId)
    .maybeSingle();
  return { supabase, row: data, error };
}

function done(): Result {
  revalidatePath("/pipeline");
  return { error: null };
}

/** Approve a match: link the payment to the chosen project (and its client when the payment has none). */
export async function linkPaymentToProjectAction(input: {
  paymentId: string;
  projectId: string;
}): Promise<Result> {
  const gate = await requireAdmin();
  if (gate.error) return gate;
  if (!UUID_RE.test(input.paymentId) || !UUID_RE.test(input.projectId)) {
    return { error: "Pick a payment and a project." };
  }
  const { supabase, row, error } = await loadPayment(input.paymentId);
  if (error || !row) return { error: error?.message ?? "Payment not found." };

  const { data: project } = await supabase
    .from("pipeline_projects")
    .select("id, client_id")
    .eq("id", input.projectId)
    .maybeSingle();
  if (!project) return { error: "Project not found." };

  const raw = (row.raw && typeof row.raw === "object" ? row.raw : {}) as Record<string, unknown>;
  const { error: upErr } = await supabase
    .from("pipeline_payments")
    .update({
      project_id: project.id,
      client_id: row.client_id ?? project.client_id ?? null,
      raw: { ...raw, match_approved_project_id: project.id },
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.paymentId);
  if (upErr) return { error: upErr.message };
  return done();
}

/** Reject one suggestion so it is not offered again for this payment. */
export async function rejectPaymentSuggestionAction(input: {
  paymentId: string;
  projectId: string;
}): Promise<Result> {
  const gate = await requireAdmin();
  if (gate.error) return gate;
  if (!UUID_RE.test(input.paymentId) || !UUID_RE.test(input.projectId)) {
    return { error: "Pick a payment and a project." };
  }
  const { supabase, row, error } = await loadPayment(input.paymentId);
  if (error || !row) return { error: error?.message ?? "Payment not found." };
  const raw = (row.raw && typeof row.raw === "object" ? row.raw : {}) as Record<string, unknown>;
  const rejected = new Set(rejectedProjectIds(raw));
  rejected.add(input.projectId);
  const { error: upErr } = await supabase
    .from("pipeline_payments")
    .update({
      raw: { ...raw, match_rejected_project_ids: [...rejected] },
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.paymentId);
  if (upErr) return { error: upErr.message };
  return done();
}

/** "This payment has no project" (or a one-off): take it out of the review queue. */
export async function markPaymentNoProjectAction(input: {
  paymentId: string;
  undo?: boolean;
}): Promise<Result> {
  const gate = await requireAdmin();
  if (gate.error) return gate;
  if (!UUID_RE.test(input.paymentId)) return { error: "Pick a payment." };
  const { supabase, row, error } = await loadPayment(input.paymentId);
  if (error || !row) return { error: error?.message ?? "Payment not found." };
  const raw = (row.raw && typeof row.raw === "object" ? row.raw : {}) as Record<string, unknown>;
  const next = { ...raw };
  if (input.undo) delete next.match_no_project;
  else next.match_no_project = true;
  const { error: upErr } = await supabase
    .from("pipeline_payments")
    .update({ raw: next, updated_at: new Date().toISOString() })
    .eq("id", input.paymentId);
  if (upErr) return { error: upErr.message };
  return done();
}

/** Admin edits any field of a payment. Hub-only: Pipeline is a one-way sync. */
export async function updatePaymentAction(input: {
  paymentId: string;
  amount: string;
  paidOn: string;
  clientId: string | null;
  projectId: string | null;
  note: string;
}): Promise<Result> {
  const gate = await requireAdmin();
  if (gate.error) return gate;
  if (!UUID_RE.test(input.paymentId)) return { error: "Pick a payment." };

  const amount = Number.parseFloat((input.amount ?? "").replace(/[$,\s]/g, ""));
  if (!Number.isFinite(amount) || Math.abs(amount) > 99_999_999) {
    return { error: "Amount must be a number (refunds can be negative)." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.paidOn ?? "")) {
    return { error: "Pick the date the payment was made." };
  }
  if (input.clientId && !UUID_RE.test(input.clientId)) return { error: "Pick a valid client." };
  if (input.projectId && !UUID_RE.test(input.projectId)) return { error: "Pick a valid project." };

  const { supabase, row, error } = await loadPayment(input.paymentId);
  if (error || !row) return { error: error?.message ?? "Payment not found." };

  const { data: current } = await supabase
    .from("pipeline_payments")
    .select("paid_at")
    .eq("id", input.paymentId)
    .maybeSingle();
  // Keep the exact time when the day did not change; otherwise use noon Eastern.
  const keepsDay =
    current?.paid_at &&
    new Date(current.paid_at as string).toLocaleDateString("en-CA", {
      timeZone: "America/New_York",
    }) === input.paidOn;
  const paidAt = keepsDay
    ? (current!.paid_at as string)
    : new Date(`${input.paidOn}T12:00:00-05:00`).toISOString();

  const raw = (row.raw && typeof row.raw === "object" ? row.raw : {}) as Record<string, unknown>;
  const { error: upErr } = await supabase
    .from("pipeline_payments")
    .update({
      amount,
      paid_at: paidAt,
      client_id: input.clientId || null,
      project_id: input.projectId || null,
      note: (input.note ?? "").trim().slice(0, 500),
      raw: { ...raw, edited_in_hub: true },
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.paymentId);
  if (upErr) return { error: upErr.message };
  if (input.projectId) revalidatePath(`/pipeline/projects/${input.projectId}`);
  revalidatePath("/reports");
  return done();
}
