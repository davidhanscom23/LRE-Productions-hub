/** Pure helpers for project contracts: merge fields, PDF-safe text, wrapping. */

export type ContractMergeContext = {
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  clientAddress?: string;
  /** Total of the project's latest invoice, e.g. "$1,500.00" (or ""). */
  feeTotal?: string;
  /** Bullet lines ("- item") from the latest invoice. */
  servicesList?: string;
  /** Plain lines, one per installment. */
  paymentSchedule?: string;
  projectName: string;
  eventDate: string; // formatted or ""
  location: string;
  companyName: string;
  today: string; // formatted
};

export const CONTRACT_MERGE_TOKENS = [
  "client_name",
  "client_email",
  "client_phone",
  "client_address",
  "fee_total",
  "services_list",
  "payment_schedule",
  "project_name",
  "event_date",
  "location",
  "company_name",
  "today",
] as const;

/** Replace {{tokens}}. Empty values become "to be confirmed" so a gap is obvious; unknown tokens stay. */
export function fillContract(text: string, ctx: ContractMergeContext): string {
  const tbc = (v: string) => (v.trim() ? v : "to be confirmed");
  const map: Record<string, string> = {
    client_name: tbc(ctx.clientName),
    client_email: tbc(ctx.clientEmail),
    client_phone: tbc(ctx.clientPhone ?? ""),
    client_address: tbc(ctx.clientAddress ?? ""),
    fee_total: tbc(ctx.feeTotal ?? ""),
    services_list: (ctx.servicesList ?? "").trim() || "- To be confirmed (see the proposal and invoice)",
    payment_schedule: (ctx.paymentSchedule ?? "").trim() || "To be confirmed (see the invoice)",
    project_name: tbc(ctx.projectName),
    event_date: tbc(ctx.eventDate),
    location: tbc(ctx.location),
    company_name: ctx.companyName,
    today: ctx.today,
  };
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (m, k: string) => map[k.toLowerCase()] ?? m);
}

/** Tokens still unreplaced in the text (so the UI can warn before sending). */
export function leftoverTokens(text: string): string[] {
  return Array.from(new Set(Array.from(text.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/gi)).map((m) => m[0])));
}

/** The standard PDF fonts only cover WinAnsi; map common typography and drop the rest. */
export function toWinAnsi(text: string): string {
  return text
    .replace(/[‘’‚]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    .replace(/\t/g, "    ")
    .replace(/[^\n\x20-\x7E¡-ÿ]/g, "");
}

/** Greedy word wrap using a measuring function (so it works with any font). */
export function wrapText(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    if (!para.trim()) {
      out.push("");
      continue;
    }
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (measure(next) <= maxWidth || !line) {
        line = next;
      } else {
        out.push(line);
        line = word;
      }
    }
    if (line) out.push(line);
  }
  return out;
}
