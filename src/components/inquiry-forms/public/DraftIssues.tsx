/**
 * /inquire/<slug>?preview=draft when the saved draft has problems (drafts are saved even when they
 * are not ready, so no work is lost). Admin-only: the page renders it only after the real-admin
 * check. Lists what to fix and links back to the builder, instead of a broken form. Server
 * component: no client JavaScript.
 */
export const DRAFT_ISSUES_RIBBON = "Draft preview - only admins see this page";

export function draftIssuesHeading(count: number): string {
  return count === 1 ? "This draft has 1 issue to fix before it can be previewed" : `This draft has ${count} issues to fix before it can be previewed`;
}

export function DraftIssues({
  formId,
  name,
  issues,
  embed = false,
}: {
  formId: string;
  name: string;
  issues: string[];
  embed?: boolean;
}) {
  return (
    <div className={embed ? "iqf-root" : "iqf-root iqf-standalone"}>
      <div className="iqf-preview" role="note">
        {DRAFT_ISSUES_RIBBON}
      </div>
      <main id="iqf-form" className="iqf-main" tabIndex={-1}>
        <div className="iqf-column">
          <div className="iqf-card">
            <h1 className="iqf-step-title">{draftIssuesHeading(issues.length)}</h1>
            <p className="iqf-step-desc">
              Your changes to {name.trim() || "this form"} are saved. Fix the list below in the builder, then open the
              preview again. Visitors do not see this draft: a published form stays as it is until you publish.
            </p>
            <ul className="iqf-issues">
              {issues.map((issue, i) => (
                <li key={`${i}-${issue}`}>{issue}</li>
              ))}
            </ul>
            <div className="iqf-issues-actions">
              <a className="iqf-btn iqf-btn-primary" href={`/inquiry-forms/${encodeURIComponent(formId)}`}>
                Open it in the builder
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
