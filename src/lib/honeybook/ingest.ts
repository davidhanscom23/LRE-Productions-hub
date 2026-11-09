import "server-only";

import { createServiceClient } from "@/lib/supabase/admin";
import { normalizeHoneyBookStage } from "@/lib/honeybook/pipeline-board";

export type HoneyBookEventType =
  | "client.created"
  | "inquiry.created"
  | "project.booked"
  | "project.stage_changed"
  | "payment.paid"
  | "meeting.scheduled"
  | "task.created"
  | "task.updated"
  | "task.completed"
  | "task.upsert"
  | "project.upsert"
  | "client.upsert"
  | "unknown";

type JsonRecord = Record<string, unknown>;

function asString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

function asNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function asDateOnly(v: unknown): string | null {
  const s = asString(v);
  if (!s) return null;
  // Accept YYYY-MM-DD or ISO datetime
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function asTimestamptz(v: unknown): string | null {
  const s = asString(v);
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function pick(obj: JsonRecord, keys: string[]): unknown {
  for (const k of keys) {
    if (obj[k] != null && obj[k] !== "") return obj[k];
    const lower = k.toLowerCase();
    for (const [ok, ov] of Object.entries(obj)) {
      if (ok.toLowerCase() === lower && ov != null && ov !== "") return ov;
    }
  }
  return undefined;
}

function nested(obj: JsonRecord, key: string): JsonRecord {
  const v = obj[key];
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return v as JsonRecord;
  }
  return {};
}

function normalizeEventType(raw: unknown): HoneyBookEventType {
  const s = asString(raw).toLowerCase().replace(/[\s-]+/g, "_");
  if (!s) return "unknown";
  if (s.includes("payment") || s.includes("paid")) return "payment.paid";
  if (s.includes("stage")) return "project.stage_changed";
  if (s.includes("booked") || s.includes("project_booked")) return "project.booked";
  if (s.includes("inquiry")) return "inquiry.created";
  if (s.includes("meeting")) return "meeting.scheduled";
  if (
    s.includes("task") &&
    (s.includes("complet") || s.includes("done") || s.includes("finish"))
  ) {
    return "task.completed";
  }
  if (s.includes("task") && (s.includes("creat") || s.includes("new"))) {
    return "task.created";
  }
  if (s.includes("task") && (s.includes("update") || s.includes("chang"))) {
    return "task.updated";
  }
  if (s === "task.upsert" || s === "task_upsert" || s.includes("task")) {
    return "task.upsert";
  }
  if (s.includes("client") && (s.includes("creat") || s.includes("upsert")))
    return "client.created";
  if (s === "project.upsert" || s === "project_upsert") return "project.upsert";
  if (s === "client.upsert" || s === "client_upsert") return "client.upsert";
  if (
    s === "client.created" ||
    s === "inquiry.created" ||
    s === "project.booked" ||
    s === "project.stage_changed" ||
    s === "payment.paid" ||
    s === "meeting.scheduled" ||
    s === "task.created" ||
    s === "task.updated" ||
    s === "task.completed"
  ) {
    return s as HoneyBookEventType;
  }
  return "unknown";
}

export type IngestResult = {
  ok: boolean;
  status: "ok" | "error" | "ignored";
  message: string;
  clientId?: string;
  projectId?: string;
  paymentId?: string;
  taskId?: string;
};

/**
 * Upsert HoneyBook entities from a Zapier (or CSV-normalized) JSON payload.
 * Accepts both nested `{ event, client, project, payment }` and flat Zapier fields.
 */
export async function ingestHoneyBookPayload(
  body: JsonRecord,
  opts?: { idempotencyKey?: string | null },
): Promise<IngestResult> {
  const supabase = createServiceClient();
  const eventType = normalizeEventType(
    pick(body, ["event", "event_type", "trigger", "zap_trigger"]) ?? "unknown",
  );
  const idem =
    asString(opts?.idempotencyKey) ||
    asString(pick(body, ["idempotency_key", "idempotencyKey", "zap_id", "id"]));

  if (idem) {
    const { data: existing } = await supabase
      .from("honeybook_webhook_events")
      .select("id, status")
      .eq("idempotency_key", idem)
      .maybeSingle();
    if (existing?.status === "ok") {
      return {
        ok: true,
        status: "ignored",
        message: "Duplicate delivery (already processed).",
      };
    }
    if (existing) {
      await supabase
        .from("honeybook_webhook_events")
        .delete()
        .eq("id", existing.id);
    }
  }

  const nestedClient = nested(body, "client");
  // Nested client identity wins over flat Zap fields (avoids project id stealing).
  const clientObj = { ...body, ...nestedClient };
  const projectObj = { ...nested(body, "project"), ...body };
  const paymentObj = { ...nested(body, "payment"), ...body };
  const taskObj = { ...nested(body, "task"), ...body };

  let clientId: string | undefined;
  let projectId: string | undefined;
  let paymentId: string | undefined;
  let paymentAmountMissing = false;
  let taskId: string | undefined;

  try {
    // ── Client ──────────────────────────────────────────────────────────
    const clientExternalId = asString(
      pick(clientObj, [
        "client_external_id",
        "client_id",
        "Client ID",
        "external_id",
      ]),
    );
    // Prefer nested client.external_id when present
    const nestedClientExt = asString(
      pick(nested(body, "client"), ["external_id", "id", "client_id"]),
    );
    const cExt = nestedClientExt || clientExternalId;

    const fullName = asString(
      pick(clientObj, [
        "client_full_name",
        "Client Full Name",
        "full_name",
        "Full Name",
        "client_name",
        "Client Name",
        "name",
      ]),
    );
    const email = asString(
      pick(clientObj, [
        "client_email",
        "Client Email",
        "email",
        "Email",
      ]),
    ).toLowerCase();
    const phone = asString(
      pick(clientObj, [
        "client_phone",
        "Client Phone",
        "phone",
        "Phone",
        "Phone Number",
        "Mobile",
        "mobile",
        "mobile_phone",
        "Mobile Phone",
        "cell",
        "Cell",
        "cell_phone",
        "Cell Phone",
      ]),
    );
    const address = asString(
      pick(clientObj, [
        "client_address",
        "Client Address",
        "address",
        "Address",
      ]),
    );

    const wantsClient =
      Boolean(fullName || email || cExt) &&
      eventType !== "unknown";

    if (wantsClient || fullName || email) {
      if (!fullName && !email) {
        // skip client upsert if we have nothing identifying
      } else {
        let existingClientId: string | null = null;
        let existingSnapshot: {
          external_id: string | null;
          full_name: string;
          email: string;
          phone: string;
          address: string;
        } | null = null;

        if (cExt) {
          const { data } = await supabase
            .from("honeybook_clients")
            .select("id, external_id, full_name, email, phone, address")
            .eq("external_id", cExt)
            .maybeSingle();
          if (data?.id) {
            existingClientId = data.id;
            existingSnapshot = data;
          }
        }
        if (!existingClientId && email) {
          const { data } = await supabase
            .from("honeybook_clients")
            .select("id, external_id, full_name, email, phone, address")
            .ilike("email", email)
            .limit(1)
            .maybeSingle();
          if (data?.id) {
            existingClientId = data.id;
            existingSnapshot = data;
          }
        }

        const clientRow = {
          external_id:
            cExt ||
            (existingSnapshot?.external_id
              ? String(existingSnapshot.external_id)
              : null),
          full_name:
            fullName ||
            existingSnapshot?.full_name ||
            email ||
            "Unknown client",
          email: email || existingSnapshot?.email || "",
          // Never wipe a known phone/email/address with a blank Zap field.
          phone: phone || existingSnapshot?.phone || "",
          address: address || existingSnapshot?.address || "",
          source_event: eventType,
          raw: body,
          updated_at: new Date().toISOString(),
        };

        if (existingClientId) {
          const { error } = await supabase
            .from("honeybook_clients")
            .update(clientRow)
            .eq("id", existingClientId);
          if (error) throw new Error(error.message);
          clientId = existingClientId;
        } else {
          const { data, error } = await supabase
            .from("honeybook_clients")
            .insert(clientRow)
            .select("id")
            .single();
          if (error) throw new Error(error.message);
          clientId = data.id;
        }
      }
    }

    // ── Project ─────────────────────────────────────────────────────────
    const nestedProjExt = asString(
      pick(nested(body, "project"), ["external_id", "id", "project_id"]),
    );
    const pExt =
      nestedProjExt ||
      asString(
        pick(projectObj, [
          "project_external_id",
          "project_id",
          "Project ID",
          "Project Id",
        ]),
      );

    const projectName = asString(
      pick(projectObj, [
        "project_name",
        "Project Name",
        "name",
        "Name",
        "Project",
      ]),
    );
    // Avoid stealing client name as project name when flat payload
    const safeProjectName =
      projectName &&
      projectName !== fullName &&
      !(nested(body, "project").name == null && nested(body, "client").full_name != null && projectName === fullName)
        ? projectName
        : asString(
            pick(nested(body, "project"), [
              "name",
              "project_name",
              "Project Name",
            ]),
          ) || projectName;

    const stage = asString(
      pick(projectObj, [
        "project_stage",
        "Project Stage",
        "stage",
        "Stage",
        "status",
        "Status",
      ]),
    );
    const projectType = asString(
      pick(projectObj, [
        "project_type",
        "Project Type",
        "type",
        "Type",
      ]),
    );
    const projectDate = asDateOnly(
      pick(projectObj, [
        "project_date",
        "Project Date",
        "event_date",
        "Event Date",
        "date",
      ]),
    );
    const budget = asNumber(
      pick(projectObj, [
        "project_budget",
        "Project Budget",
        "budget",
        "Budget",
      ]),
    );
    const location = asString(
      pick(projectObj, [
        "project_location",
        "Project Location",
        "location",
        "Location",
      ]),
    );
    const details = asString(
      pick(projectObj, [
        "project_details",
        "Project Details",
        "details",
        "Details",
        "note",
        "Note",
      ]),
    );
    let bookedAt = asTimestamptz(
      pick(projectObj, ["booked_at", "Booked At", "booked_date"]),
    );
    if (eventType === "project.booked" && !bookedAt) {
      bookedAt = new Date().toISOString();
    }
    if (eventType === "project.booked" && !stage) {
      // stage defaults to Retainer Paid below
    }

    const effectiveStage = normalizeHoneyBookStage(
      stage ||
      (eventType === "project.booked"
        ? "Retainer Paid"
        : eventType === "inquiry.created"
          ? "Inquiry"
          : ""),
    );

    const hasProjectSignal = Boolean(
      safeProjectName || pExt || effectiveStage || eventType.startsWith("project"),
    );

    if (hasProjectSignal && (safeProjectName || pExt)) {
      const name =
        safeProjectName ||
        (fullName ? `${fullName} project` : "Untitled project");

      let existingProjectId: string | null = null;
      if (pExt) {
        const { data } = await supabase
          .from("honeybook_projects")
          .select("id")
          .eq("external_id", pExt)
          .maybeSingle();
        existingProjectId = data?.id ?? null;
      }

      const projectRow: Record<string, unknown> = {
        external_id: pExt || null,
        name,
        source_event: eventType,
        raw: body,
        updated_at: new Date().toISOString(),
      };
      if (clientId) projectRow.client_id = clientId;
      if (effectiveStage) projectRow.stage = effectiveStage;
      if (projectType) projectRow.project_type = projectType;
      if (projectDate) projectRow.project_date = projectDate;
      if (budget != null) projectRow.budget = budget;
      if (location) projectRow.location = location;
      if (details) projectRow.details = details;
      if (bookedAt) projectRow.booked_at = bookedAt;

      if (existingProjectId) {
        const { error } = await supabase
          .from("honeybook_projects")
          .update(projectRow)
          .eq("id", existingProjectId);
        if (error) throw new Error(error.message);
        projectId = existingProjectId;
      } else {
        if (!projectRow.stage) projectRow.stage = effectiveStage || "";
        const { data, error } = await supabase
          .from("honeybook_projects")
          .insert(projectRow)
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        projectId = data.id;
      }
    }

    // ── Payment ─────────────────────────────────────────────────────────
    const wantsPayment =
      eventType === "payment.paid" ||
      Boolean(nested(body, "payment").amount) ||
      pick(paymentObj, ["payment_amount", "Payment Amount", "amount_paid"]) !=
        null;

    if (wantsPayment) {
      const payExt =
        asString(
          pick(nested(body, "payment"), ["external_id", "id", "payment_id"]),
        ) ||
        asString(
          pick(paymentObj, [
            "payment_external_id",
            "payment_id",
            "Payment ID",
          ]),
        );
      const parsedAmount =
        asNumber(
          pick(nested(body, "payment"), [
            "amount",
            "payment_amount",
            "amount_paid",
            "total",
            "payment_total",
          ]),
        ) ??
        asNumber(
          pick(paymentObj, [
            "payment_amount",
            "Payment Amount",
            "amount",
            "Amount",
            "amount_paid",
            "Amount Paid",
            "payment_total",
            "Payment Total",
            "total_paid",
          ]),
        );
      if (parsedAmount == null) paymentAmountMissing = true;
      const amount = parsedAmount ?? 0;
      const currency =
        asString(
          pick(paymentObj, ["currency", "Currency", "payment_currency"]),
        ) || "USD";
      const paidAt =
        asTimestamptz(
          pick(paymentObj, [
            "paid_at",
            "Paid At",
            "payment_date",
            "Payment Date",
          ]),
        ) || new Date().toISOString();
      const note = asString(
        pick(paymentObj, [
          "payment_note",
          "Payment Note",
          "note",
          "Note",
        ]),
      );

      let existingPaymentId: string | null = null;
      if (payExt) {
        const { data } = await supabase
          .from("honeybook_payments")
          .select("id")
          .eq("external_id", payExt)
          .maybeSingle();
        existingPaymentId = data?.id ?? null;
      }

      const paymentRow = {
        external_id: payExt || null,
        client_id: clientId ?? null,
        project_id: projectId ?? null,
        amount,
        currency,
        paid_at: paidAt,
        note,
        source_event: eventType,
        raw: body,
        updated_at: new Date().toISOString(),
      };

      if (existingPaymentId) {
        const { error } = await supabase
          .from("honeybook_payments")
          .update(paymentRow)
          .eq("id", existingPaymentId);
        if (error) throw new Error(error.message);
        paymentId = existingPaymentId;
      } else {
        const { data, error } = await supabase
          .from("honeybook_payments")
          .insert(paymentRow)
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        paymentId = data.id;
      }
    }

    // ── Task ────────────────────────────────────────────────────────────
    const wantsTask =
      eventType === "task.created" ||
      eventType === "task.updated" ||
      eventType === "task.completed" ||
      eventType === "task.upsert" ||
      Boolean(nested(body, "task").title) ||
      pick(taskObj, [
        "task_title",
        "Task Title",
        "task_name",
        "Task Name",
      ]) != null;

    if (wantsTask) {
      const taskNested = nested(body, "task");
      const taskExt =
        asString(
          pick(taskNested, ["external_id", "id", "task_id"]),
        ) ||
        asString(
          pick(taskObj, [
            "task_external_id",
            "task_id",
            "Task ID",
            "Task Id",
          ]),
        );
      const title =
        asString(pick(taskNested, ["title", "name", "subject"])) ||
        asString(
          pick(taskObj, [
            "task_title",
            "Task Title",
            "task_name",
            "Task Name",
            "title",
            "Title",
          ]),
        );
      const dueDate =
        asDateOnly(pick(taskNested, ["due_date", "dueDate", "due"])) ||
        asDateOnly(
          pick(taskObj, [
            "task_due_date",
            "Task Due Date",
            "due_date",
            "Due Date",
            "due",
          ]),
        );
      const assigneeEmail = (
        asString(
          pick(taskNested, [
            "assignee_email",
            "assigneeEmail",
            "assigned_to_email",
            "email",
          ]),
        ) ||
        asString(
          pick(taskObj, [
            "task_assignee_email",
            "assignee_email",
            "Assignee Email",
            "Assigned To Email",
            "assigneeEmail",
          ]),
        )
      ).toLowerCase();
      const assigneeName =
        asString(
          pick(taskNested, [
            "assignee_name",
            "assigneeName",
            "assigned_to",
            "assignee",
          ]),
        ) ||
        asString(
          pick(taskObj, [
            "task_assignee_name",
            "assignee_name",
            "Assignee Name",
            "Assigned To",
            "Assignee",
          ]),
        );
      const notes =
        asString(pick(taskNested, ["notes", "note", "description"])) ||
        asString(
          pick(taskObj, [
            "task_notes",
            "Task Notes",
            "notes",
            "Notes",
            "description",
          ]),
        );
      const projectName =
        asString(pick(taskNested, ["project_name", "projectName"])) ||
        asString(
          pick(taskObj, [
            "task_project_name",
            "project_name",
            "Project Name",
          ]),
        ) ||
        asString(pick(projectObj, ["name", "project_name", "Project Name"]));

      const statusRaw = (
        asString(pick(taskNested, ["status", "state", "completed"])) ||
        asString(
          pick(taskObj, [
            "task_status",
            "Task Status",
            "status",
            "Status",
            "completed",
          ]),
        ) ||
        (eventType === "task.completed" ? "done" : "open")
      ).toLowerCase();
      const status =
        eventType === "task.completed" ||
        statusRaw === "done" ||
        statusRaw === "completed" ||
        statusRaw === "complete" ||
        statusRaw === "true" ||
        statusRaw === "yes"
          ? "done"
          : "open";

      if (title) {
        let assigneeProfileId: string | null = null;
        if (assigneeEmail) {
          const { data: profileMatch } = await supabase
            .from("profiles")
            .select("id")
            .ilike("email", assigneeEmail)
            .maybeSingle();
          assigneeProfileId = profileMatch?.id ?? null;
        }

        // Prefer project already resolved in this payload; else match external id.
        let taskProjectId = projectId ?? null;
        const taskProjectExt =
          asString(pick(taskNested, ["project_id", "project_external_id"])) ||
          asString(
            pick(taskObj, [
              "task_project_id",
              "project_external_id",
              "Project ID",
            ]),
          );
        if (!taskProjectId && taskProjectExt) {
          const { data: pMatch } = await supabase
            .from("honeybook_projects")
            .select("id")
            .eq("external_id", taskProjectExt)
            .maybeSingle();
          taskProjectId = pMatch?.id ?? null;
        }

        let existingTaskId: string | null = null;
        if (taskExt) {
          const { data } = await supabase
            .from("honeybook_tasks")
            .select("id")
            .eq("external_id", taskExt)
            .maybeSingle();
          existingTaskId = data?.id ?? null;
        }

        const taskRow: Record<string, unknown> = {
          external_id: taskExt || null,
          title: title.slice(0, 500),
          due_date: dueDate,
          status,
          assignee_email: assigneeEmail.slice(0, 200),
          assignee_name: assigneeName.slice(0, 200),
          assignee_profile_id: assigneeProfileId,
          project_id: taskProjectId,
          client_id: clientId ?? null,
          project_name: projectName.slice(0, 300),
          notes: notes.slice(0, 4000),
          source_event: eventType,
          raw: body,
          updated_at: new Date().toISOString(),
        };

        if (existingTaskId) {
          const { error } = await supabase
            .from("honeybook_tasks")
            .update(taskRow)
            .eq("id", existingTaskId);
          if (error) throw new Error(error.message);
          taskId = existingTaskId;
        } else {
          const { data, error } = await supabase
            .from("honeybook_tasks")
            .insert(taskRow)
            .select("id")
            .single();
          if (error) throw new Error(error.message);
          taskId = data.id;
        }
      }
    }

    if (!clientId && !projectId && !paymentId && !taskId) {
      const msg = "No client, project, payment, or task fields recognized.";
      await logWebhookEvent(supabase, {
        eventType,
        idem,
        payload: body,
        status: "ignored",
        errorMessage: msg,
      });
      return { ok: true, status: "ignored", message: msg };
    }

    await logWebhookEvent(supabase, {
      eventType,
      idem,
      payload: body,
      status: paymentAmountMissing ? "error" : "ok",
      errorMessage: paymentAmountMissing
        ? "Payment saved with no amount: the Zap did not send one. Add a payment object with Payment Amount to the New Payment Paid Zap (see Zapier setup)."
        : "",
    });

    return {
      ok: true,
      status: "ok",
      message: "Synced.",
      clientId,
      projectId,
      paymentId,
      taskId,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ingest failed.";
    await logWebhookEvent(supabase, {
      eventType,
      idem,
      payload: body,
      status: "error",
      errorMessage: msg,
    });
    return { ok: false, status: "error", message: msg };
  }
}

async function logWebhookEvent(
  supabase: ReturnType<typeof createServiceClient>,
  args: {
    eventType: string;
    idem: string;
    payload: JsonRecord;
    status: "ok" | "error" | "ignored";
    errorMessage: string;
  },
) {
  const row = {
    event_type: args.eventType,
    idempotency_key: args.idem || null,
    payload: args.payload,
    status: args.status,
    error_message: args.errorMessage.slice(0, 2000),
  };
  // Partial unique index on idempotency_key — insert and ignore races.
  const { error } = await supabase.from("honeybook_webhook_events").insert(row);
  if (error && !/duplicate|unique/i.test(error.message)) {
    console.error("[honeybook] webhook log failed:", error.message);
  }
}
