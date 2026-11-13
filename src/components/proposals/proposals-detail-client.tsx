"use client";

import Link from "next/link";
import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteProposalAction,
  generateProposalPdfAction,
  linkProposalToPipelineAction,
  searchPipelineProjectsAction,
  updateProposalMetaAction,
  uploadProposalToDriveAction,
} from "@/app/(app)/proposals/actions";
import { QUOTE_DEPARTMENT_OPTIONS, formatQuoteMoney } from "@/lib/types/quoting";
import {
  proposalStatusLabel,
  type Proposal,
  type ProposalStatus,
} from "@/lib/types/proposals";

type Props = {
  isAdmin: boolean;
  driveConfigured: boolean;
  proposal: Proposal;
};

const STATUS_STYLES: Record<ProposalStatus, string> = {
  draft: "bg-slate-100 text-slate-800 dark:bg-slate-900/50 dark:text-slate-200",
  generated:
    "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200",
  uploaded:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
  linked:
    "bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200",
};

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      {children}
    </section>
  );
}

export function ProposalsDetailClient({
  isAdmin,
  driveConfigured,
  proposal,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [title, setTitle] = useState(proposal.title);
  const [clientName, setClientName] = useState(proposal.client_name);
  const [eventName, setEventName] = useState(proposal.event_name);
  const [eventDate, setEventDate] = useState(proposal.event_date ?? "");
  const [department, setDepartment] = useState(proposal.department);
  const [intro, setIntro] = useState(proposal.intro);
  const [notes, setNotes] = useState(proposal.notes);
  const [metaMsg, setMetaMsg] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [hbQuery, setHbQuery] = useState("");
  const [hbResults, setHbResults] = useState<
    { id: string; name: string; stage: string; client_name: string | null }[]
  >([]);
  const [selectedHb, setSelectedHb] = useState(
    proposal.pipeline_project_id ?? "",
  );

  function saveMeta(event: FormEvent) {
    event.preventDefault();
    setMetaMsg(null);
    setActionError(null);
    startTransition(async () => {
      const r = await updateProposalMetaAction({
        id: proposal.id,
        title,
        intro,
        notes,
        clientName,
        eventName,
        eventDate,
        department,
      });
      if (r.error) {
        setActionError(r.error);
        return;
      }
      setMetaMsg("Details saved.");
      router.refresh();
    });
  }

  function downloadPdf() {
    setActionError(null);
    setActionMsg(null);
    startTransition(async () => {
      const r = await generateProposalPdfAction(proposal.id);
      if (r.error || !r.pdfBase64) {
        setActionError(r.error ?? "Could not generate PDF.");
        return;
      }
      const bytes = Uint8Array.from(atob(r.pdfBase64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(proposal.client_name || "Proposal").replace(/\s+/g, "-")}-proposal.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setActionMsg("PDF downloaded.");
      router.refresh();
    });
  }

  function uploadDrive() {
    setActionError(null);
    setActionMsg(null);
    startTransition(async () => {
      const r = await uploadProposalToDriveAction(proposal.id);
      if (r.error) {
        setActionError(r.error);
        return;
      }
      setActionMsg("Uploaded to Google Drive.");
      router.refresh();
    });
  }

  function copyLink() {
    if (!proposal.drive_web_view_link) return;
    void navigator.clipboard.writeText(proposal.drive_web_view_link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function searchHb(event: FormEvent) {
    event.preventDefault();
    setActionError(null);
    startTransition(async () => {
      const r = await searchPipelineProjectsAction(hbQuery);
      if (r.error) {
        setActionError(r.error);
        return;
      }
      setHbResults(r.projects ?? []);
    });
  }

  function linkHb() {
    if (!selectedHb) {
      setActionError("Pick a Pipeline project first.");
      return;
    }
    setActionError(null);
    setActionMsg(null);
    startTransition(async () => {
      const r = await linkProposalToPipelineAction({
        proposalId: proposal.id,
        pipelineProjectId: selectedHb,
      });
      if (r.error) {
        setActionError(r.error);
        return;
      }
      setActionMsg(
        "Drive link written onto the Pipeline project details in the Hub.",
      );
      router.refresh();
    });
  }

  function removeProposal() {
    if (!confirm("Delete this proposal?")) return;
    startTransition(async () => {
      const r = await deleteProposalAction(proposal.id);
      if (r.error) alert(r.error);
      else router.push("/proposals");
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <div>
        <Link
          href="/proposals"
          className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          ← Proposals
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold text-[var(--foreground)]">
            {proposal.title || "Proposal"}
          </h1>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[proposal.status]}`}
          >
            {proposalStatusLabel(proposal.status)}
          </span>
        </div>
        {proposal.quote_id ? (
          <p className="mt-1 text-sm text-[var(--muted)]">
            From quote{" "}
            <Link
              href={`/quoting/${proposal.quote_id}`}
              className="text-[var(--brand)] hover:underline"
            >
              open in Quoting
            </Link>
          </p>
        ) : null}
      </div>

      <Card>
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          Details
        </h2>
        <form onSubmit={saveMeta} className="mt-3 space-y-3">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--brand)]"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Client</span>
              <input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--brand)]"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Event</span>
              <input
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--brand)]"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Event date</span>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--brand)]"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Department</span>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--brand)]"
              >
                {QUOTE_DEPARTMENT_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Intro</span>
            <textarea
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Notes (on PDF)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
            />
          </label>
          {metaMsg ? (
            <p className="text-sm text-emerald-700 dark:text-emerald-300">
              {metaMsg}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-9 items-center rounded-lg border border-[var(--border)] px-4 text-sm font-semibold hover:bg-[var(--surface-hover)] disabled:opacity-50"
          >
            Save details
          </button>
        </form>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          Line items
        </h2>
        <ul className="mt-3 divide-y divide-[var(--border)] text-sm">
          {proposal.lines_snapshot.map((line, idx) => (
            <li
              key={`${line.label}-${idx}`}
              className="flex flex-wrap justify-between gap-2 py-2"
            >
              <span>
                {line.label}{" "}
                <span className="text-[var(--muted)]">× {line.quantity}</span>
              </span>
              <span className="font-medium">
                {formatQuoteMoney(line.quote_unit_price * line.quantity)}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm font-semibold text-[var(--foreground)]">
          Total {formatQuoteMoney(proposal.quote_total)}
        </p>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          PDF &amp; Drive
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Generate a branded LRE PDF, then upload it under{" "}
          <code className="text-xs">Proposals / client / event</code> in the
          company Drive folder.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={downloadPdf}
            className="inline-flex h-9 items-center rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            Download PDF
          </button>
          <button
            type="button"
            disabled={pending || !driveConfigured}
            onClick={uploadDrive}
            className="inline-flex h-9 items-center rounded-lg border border-[var(--border)] px-4 text-sm font-semibold hover:bg-[var(--surface-hover)] disabled:opacity-50"
            title={
              driveConfigured
                ? "Upload to Google Drive"
                : "Drive is not configured"
            }
          >
            Upload to Drive
          </button>
        </div>
        {proposal.drive_web_view_link ? (
          <div className="mt-3 space-y-2 rounded-xl border border-[var(--border)] bg-[var(--background)] p-3 text-sm">
            <p className="text-[var(--muted)]">
              Drive folder: {proposal.drive_folder_path || "Proposals"}
            </p>
            <a
              href={proposal.drive_web_view_link}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all font-medium text-[var(--brand)] hover:underline"
            >
              {proposal.drive_web_view_link}
            </a>
            <div>
              <button
                type="button"
                onClick={copyLink}
                className="text-xs font-medium text-[var(--muted)] underline-offset-2 hover:underline"
              >
                {copied ? "Copied!" : "Copy Drive link for Pipeline"}
              </button>
            </div>
          </div>
        ) : null}
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          Pipeline
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Pipeline has no outbound file API in the Hub. After Drive upload,
          copy the link into Pipeline, or (admins) write it onto the mirrored
          project details here.
        </p>
        {proposal.pipeline_project_name ? (
          <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
            Linked to {proposal.pipeline_project_name}
            {proposal.pipeline_linked_at
              ? ` · ${new Date(proposal.pipeline_linked_at).toLocaleString()}`
              : ""}
          </p>
        ) : null}

        {isAdmin ? (
          <div className="mt-3 space-y-3">
            <form onSubmit={searchHb} className="flex flex-wrap gap-2">
              <input
                value={hbQuery}
                onChange={(e) => setHbQuery(e.target.value)}
                placeholder="Search Pipeline projects"
                className="h-10 min-w-[200px] flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--brand)]"
              />
              <button
                type="submit"
                disabled={pending}
                className="inline-flex h-10 items-center rounded-lg border border-[var(--border)] px-4 text-sm font-semibold disabled:opacity-50"
              >
                Search
              </button>
            </form>
            {hbResults.length > 0 ? (
              <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
                {hbResults.map((p) => (
                  <li key={p.id}>
                    <label className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-[var(--surface-hover)]">
                      <input
                        type="radio"
                        name="hb"
                        checked={selectedHb === p.id}
                        onChange={() => setSelectedHb(p.id)}
                        className="mt-1"
                      />
                      <span>
                        <span className="font-medium text-[var(--foreground)]">
                          {p.name}
                        </span>
                        <span className="block text-xs text-[var(--muted)]">
                          {p.stage}
                          {p.client_name ? ` · ${p.client_name}` : ""}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : null}
            <button
              type="button"
              disabled={pending || !proposal.drive_web_view_link || !selectedHb}
              onClick={linkHb}
              className="inline-flex h-9 items-center rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              Write Drive link on Pipeline project
            </button>
          </div>
        ) : (
          <p className="mt-2 text-sm text-[var(--muted)]">
            Ask an admin to link the Hub CRM project, or paste the copied Drive
            link into Pipeline yourself.
          </p>
        )}
      </Card>

      {actionError ? (
        <p className="text-sm text-red-700 dark:text-red-300">{actionError}</p>
      ) : null}
      {actionMsg ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-300">
          {actionMsg}
        </p>
      ) : null}

      <button
        type="button"
        disabled={pending}
        onClick={removeProposal}
        className="text-xs font-medium text-red-700 underline-offset-2 hover:underline dark:text-red-300 disabled:opacity-50"
      >
        Delete proposal
      </button>
    </div>
  );
}
