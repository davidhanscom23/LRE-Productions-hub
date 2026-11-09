import { getCurrentProfile } from "@/lib/auth/profile";
import { toCsv, type CsvColumn } from "@/lib/honeybook/csv";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;

/** Page through a table so exports aren't cut off at the API's default row limit. */
async function fetchAll(table: string, select: string, order = "created_at"): Promise<Row[]> {
  const supabase = await createClient();
  const out: Row[] = [];
  for (let from = 0; from < 50_000; from += 1000) {
    const { data, error } = await supabase.from(table).select(select).order(order, { ascending: true }).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    const rows = (data ?? []) as unknown as Row[];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

const col = (header: string, key: string): CsvColumn<Row> => ({ header, value: (r) => r[key] });

/** Admin-only CSV backups of the Hub's HoneyBook data (it includes money). */
export async function GET(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") return new Response("Admins only", { status: 403 });
  const set = new URL(req.url).searchParams.get("set") ?? "";

  try {
    let csv: string;
    if (set === "projects") {
      const rows = await fetchAll("honeybook_projects", "id, name, stage, project_type, project_date, budget, location, details, booked_at, record_type, created_at, honeybook_clients(full_name, email, phone)");
      csv = toCsv(rows, [
        col("id", "id"), col("name", "name"), col("stage", "stage"), col("type", "project_type"),
        col("event_date", "project_date"), col("budget", "budget"), col("location", "location"),
        col("booked_at", "booked_at"), col("record_type", "record_type"), col("created_at", "created_at"),
        { header: "client_name", value: (r) => (r.honeybook_clients as Row | null)?.full_name },
        { header: "client_email", value: (r) => (r.honeybook_clients as Row | null)?.email },
        { header: "client_phone", value: (r) => (r.honeybook_clients as Row | null)?.phone },
        col("details", "details"),
      ]);
    } else if (set === "clients") {
      const rows = await fetchAll("honeybook_clients", "id, full_name, email, phone, address, created_at");
      csv = toCsv(rows, [col("id", "id"), col("full_name", "full_name"), col("email", "email"), col("phone", "phone"), col("address", "address"), col("created_at", "created_at")]);
    } else if (set === "payments") {
      const rows = await fetchAll("honeybook_payments", "id, amount, currency, paid_at, note, created_at, honeybook_projects(name), honeybook_clients(full_name)");
      csv = toCsv(rows, [
        col("id", "id"), col("amount", "amount"), col("currency", "currency"), col("paid_at", "paid_at"), col("note", "note"),
        { header: "project", value: (r) => (r.honeybook_projects as Row | null)?.name },
        { header: "client", value: (r) => (r.honeybook_clients as Row | null)?.full_name },
      ]);
    } else if (set === "invoices") {
      const rows = await fetchAll("project_invoices", "number, title, status, issued_at, due_at, subtotal, tax_amount, total, amount_paid, created_at, honeybook_projects(name)");
      csv = toCsv(rows, [
        col("number", "number"), col("title", "title"), col("status", "status"), col("issued_at", "issued_at"), col("due_at", "due_at"),
        col("subtotal", "subtotal"), col("tax", "tax_amount"), col("total", "total"), col("amount_paid", "amount_paid"),
        { header: "project", value: (r) => (r.honeybook_projects as Row | null)?.name },
      ]);
    } else if (set === "contracts") {
      const rows = await fetchAll("project_contracts", "title, status, sent_at, signer_name, signer_email, signed_at, body_hash, created_at, honeybook_projects(name)");
      csv = toCsv(rows, [
        col("title", "title"), col("status", "status"), col("sent_at", "sent_at"), col("signer_name", "signer_name"),
        col("signer_email", "signer_email"), col("signed_at", "signed_at"), col("fingerprint", "body_hash"),
        { header: "project", value: (r) => (r.honeybook_projects as Row | null)?.name },
      ]);
    } else if (set === "notes") {
      const rows = await fetchAll("honeybook_project_notes", "occurred_at, source, category, body, honeybook_projects(name)", "occurred_at");
      csv = toCsv(rows, [
        col("when", "occurred_at"), col("source", "source"), col("category", "category"), col("note", "body"),
        { header: "project", value: (r) => (r.honeybook_projects as Row | null)?.name },
      ]);
    } else {
      return new Response("Unknown export", { status: 400 });
    }
    const stamp = new Date().toISOString().slice(0, 10);
    return new Response("﻿" + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="hub-${set}-${stamp}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "Export failed", { status: 500 });
  }
}
