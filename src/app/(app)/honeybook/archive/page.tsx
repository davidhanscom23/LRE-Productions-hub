import { ArchiveClient } from "@/components/honeybook/archive-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import { canManageHoneyBookCrm } from "@/lib/honeybook/access";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const EXPORTS = [
  { set: "projects", label: "Projects", help: "Every project with its client, stage, date, budget and details." },
  { set: "clients", label: "Clients", help: "Names, emails, phones and addresses." },
  { set: "payments", label: "Payments", help: "Payments synced from HoneyBook." },
  { set: "invoices", label: "Invoices", help: "Invoices made in the Hub." },
  { set: "contracts", label: "Contracts", help: "Who signed what and when (the signed PDFs are on each project)." },
  { set: "notes", label: "Notes and emails", help: "Every note, email log and status change." },
];

export default async function HoneyBookArchivePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canManageHoneyBookCrm(profile.role)) redirect("/honeybook");
  const isAdmin = profile.role === "admin";

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("honeybook_projects")
    .select("id, name, merged_into, honeybook_clients(full_name)")
    .is("merged_into", null)
    .order("name", { ascending: true })
    .limit(2000);
  const projects = (rows ?? []).map((r) => {
    const c = r.honeybook_clients as { full_name: string | null } | { full_name: string | null }[] | null;
    const client = Array.isArray(c) ? c[0] : c;
    return { id: r.id as string, name: String(r.name ?? ""), clientName: String(client?.full_name ?? "") };
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-semibold">HoneyBook archive and backup</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Move your history out of HoneyBook and keep a backup of everything in the Hub.
        </p>
      </div>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
        <h2 className="text-sm font-semibold">1. File your HoneyBook documents on their projects</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-[var(--muted)]">
          <li>In HoneyBook, open each signed contract, invoice and proposal you want to keep and download the PDF (or use HoneyBook&apos;s export if your plan has it).</li>
          <li>Drop all the files here. The Hub guesses the project from the file name and the document type.</li>
          <li>Check each guess (anything uncertain is flagged), fix any that are wrong, then click Upload.</li>
        </ol>
        <ArchiveClient projects={projects} />
      </section>

      {isAdmin ? (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
          <h2 className="text-sm font-semibold">2. Download a backup (admins)</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Spreadsheet files (CSV) you can keep or open in Excel or Google Sheets. They include money, so store them somewhere private.
          </p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {EXPORTS.map((e) => (
              <li key={e.set} className="rounded-xl border border-[var(--border)] p-3 text-sm">
                <p className="font-medium">{e.label}</p>
                <p className="text-xs text-[var(--muted)]">{e.help}</p>
                <a className="mt-2 inline-block rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-xs font-medium" href={`/api/honeybook/export?set=${e.set}`}>
                  Download CSV
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
