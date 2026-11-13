import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProjectPublicFiles } from "@/components/pipeline/project-public-files";
import { ProjectPublicQuestionnaire } from "@/components/pipeline/project-public-questionnaire";
import { COMPANY } from "@/lib/company";
import { loadPortalItems } from "@/lib/pipeline/portal-server";
import { isEmptyPortal, portalActionItems } from "@/lib/pipeline/portal";
import { formatPipelineMoney } from "@/lib/types/pipeline";
import { formatPipelineStageLabel } from "@/lib/pipeline/pipeline-board";
import {
  loadPublicProjectByToken,
  PROJECT_TOKEN_RE,
} from "@/lib/pipeline/public-project";

type Props = { params: Promise<{ token: string }> };

export const metadata: Metadata = {
  title: `Project | ${COMPANY.displayName}`,
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function fmtDate(iso: string | null) {
  if (!iso) return null;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${iso}T00:00:00Z`));
}

export default async function PublicCrmProjectPage({ params }: Props) {
  const { token } = await params;
  if (!PROJECT_TOKEN_RE.test(token)) notFound();

  const project = await loadPublicProjectByToken(token);
  if (!project) notFound();

  const portal = await loadPortalItems(project.id);
  const todayIso = new Date().toISOString().slice(0, 10);
  const actions = portalActionItems(portal, todayIso);
  const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
  const dateLabel = fmtDate(project.projectDate);
  const meta = [
    project.projectType || null,
    dateLabel,
    project.location || null,
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto max-w-xl px-5 py-12 sm:py-16">
        <p className="text-xs font-semibold tracking-[0.18em] text-[var(--muted)] uppercase">
          {COMPANY.displayName}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          {project.name}
        </h1>
        {project.stage ? (
          <p className="mt-3 inline-block rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-medium text-[var(--muted)]">
            {formatPipelineStageLabel(project.stage)}
          </p>
        ) : null}

        {meta.length > 0 ? (
          <p className="mt-5 text-sm text-[var(--muted)]">{meta.join(" · ")}</p>
        ) : null}

        {project.budget != null ? (
          <p className="mt-2 text-sm text-[var(--foreground)]">
            Budget {formatPipelineMoney(project.budget)}
          </p>
        ) : null}

        {actions.length > 0 ? (
          <section className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <h2 className="text-xs font-semibold tracking-[0.14em] text-[var(--muted)] uppercase">
              Needs your attention
            </h2>
            <ul className="mt-3 space-y-2">
              {actions.map((a) => (
                <li key={a.href} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>{a.label}</span>
                  <a
                    href={a.href}
                    className="rounded-lg bg-[var(--accent,#2563eb)] px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    {a.cta}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {!isEmptyPortal(portal) ? (
          <section className="mt-8 border-t border-[var(--border)] pt-6 space-y-5">
            {portal.contracts.length > 0 ? (
              <div>
                <h2 className="text-xs font-semibold tracking-[0.14em] text-[var(--muted)] uppercase">Contracts</h2>
                <ul className="mt-2 space-y-1 text-sm">
                  {portal.contracts.map((c) => (
                    <li key={c.url} className="flex justify-between gap-2">
                      <a className="underline-offset-2 hover:underline" href={c.url}>{c.title}</a>
                      <span className="text-[var(--muted)]">
                        {c.status === "signed" ? "Signed" : c.status === "declined" ? "Declined" : "Awaiting your signature"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {portal.invoices.length > 0 ? (
              <div>
                <h2 className="text-xs font-semibold tracking-[0.14em] text-[var(--muted)] uppercase">Invoices</h2>
                <ul className="mt-2 space-y-1 text-sm">
                  {portal.invoices.map((i) => (
                    <li key={i.url} className="flex justify-between gap-2">
                      <a className="underline-offset-2 hover:underline" href={i.url}>
                        {i.number}{i.title ? ` · ${i.title}` : ""}
                      </a>
                      <span className="text-[var(--muted)]">
                        {i.balance > 0 ? `${money(i.balance)} due` : "Paid"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {portal.floorPlans.length > 0 ? (
              <div>
                <h2 className="text-xs font-semibold tracking-[0.14em] text-[var(--muted)] uppercase">Floor plans</h2>
                <ul className="mt-2 space-y-1 text-sm">
                  {portal.floorPlans.map((f) => (
                    <li key={f.url}>
                      <a className="underline-offset-2 hover:underline" href={f.url}>
                        {f.name}{f.spaceName ? ` · ${f.spaceName}` : ""}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {portal.meetings.length > 0 ? (
              <div>
                <h2 className="text-xs font-semibold tracking-[0.14em] text-[var(--muted)] uppercase">Book a call</h2>
                <ul className="mt-2 space-y-1 text-sm">
                  {portal.meetings.map((m) => (
                    <li key={m.url}>
                      <a className="underline-offset-2 hover:underline" href={m.url}>
                        {m.title} ({m.minutes} min)
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        ) : null}

        {(project.clientName || project.clientEmail || project.clientPhone) && (
          <section className="mt-8 border-t border-[var(--border)] pt-6">
            <h2 className="text-xs font-semibold tracking-[0.14em] text-[var(--muted)] uppercase">
              Client
            </h2>
            {project.clientName ? (
              <p className="mt-2 text-sm font-medium">{project.clientName}</p>
            ) : null}
            {project.clientEmail ? (
              <p className="text-sm text-[var(--muted)]">{project.clientEmail}</p>
            ) : null}
            {project.clientPhone ? (
              <p className="text-sm text-[var(--muted)]">{project.clientPhone}</p>
            ) : null}
          </section>
        )}

        {project.details.trim() ? (
          <section className="mt-8 border-t border-[var(--border)] pt-6">
            <h2 className="text-xs font-semibold tracking-[0.14em] text-[var(--muted)] uppercase">
              Details
            </h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--foreground)]">
              {project.details}
            </p>
          </section>
        ) : null}

        <ProjectPublicQuestionnaire
          token={token}
          answers={project.questionnaireAnswers}
          submittedAt={project.questionnaireSubmittedAt}
        />

        <ProjectPublicFiles token={token} files={project.files} />

        <p className="mt-12 text-xs text-[var(--muted)]">
          Shared by {COMPANY.displayName}. Use the links above to sign, pay, and book. You can also answer the questionnaire and upload files here.
        </p>
      </div>
    </div>
  );
}
