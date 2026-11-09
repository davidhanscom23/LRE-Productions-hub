import Link from "next/link";
import { NEEDS_MIGRATION_MESSAGE } from "./list-types";
import { Notice, PageHeader } from "./list-ui";

/**
 * Shown by the Inquiry Forms admin pages when the inquiry tables are missing
 * (the Inquiry Forms migration is not applied yet) instead of crashing.
 */
export function MigrationNotice({ title = "Inquiry Forms" }: { title?: string }) {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={title} />
      <Notice tone="warn" title="One more step before this page works">
        <p>{NEEDS_MIGRATION_MESSAGE}.</p>
        <p className="mt-2">
          The <Link href="/hub-health" className="font-medium underline">Hub health</Link> page shows what is
          missing. Once it is in place, reload this page.
        </p>
      </Notice>
    </div>
  );
}

/** Generic load failure (anything other than the missing migration). */
export function LoadErrorNotice({ title = "Inquiry Forms", message }: { title?: string; message?: string }) {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={title} />
      <Notice tone="bad" title="This page could not load">
        <p>Please refresh the page and try again.</p>
        {message ? <p className="mt-2 break-words">Details: {message}</p> : null}
      </Notice>
    </div>
  );
}
