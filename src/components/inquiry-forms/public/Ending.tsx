"use client";

/**
 * Inquiry Forms public renderer - the ending screen (server copy for completed or waitlisted), plus the
 * redirect states: navigating ("Taking you to <host>..."), or a manual "Continue" link when an embedding
 * page did not acknowledge the redirect (a bare iframe without the embed script), or in preview.
 */
import type { RefObject } from "react";
import { Check, Clock, LoaderCircle } from "lucide-react";
import { hostOf, type Ending as EndingCopy } from "./flow";

export type RedirectState =
  | { phase: "none" }
  | { phase: "navigating"; url: string }
  | { phase: "waiting"; url: string }
  | { phase: "manual"; url: string; target: "_top" | "_self" };

export function Ending({
  ending,
  redirect,
  headingRef,
  previewNote,
}: {
  ending: EndingCopy;
  redirect: RedirectState;
  headingRef: RefObject<HTMLHeadingElement | null>;
  previewNote: boolean;
}) {
  const waitlisted = ending.kind === "waitlisted";
  const host = redirect.phase === "none" ? null : hostOf(redirect.url);
  return (
    <div className="iqf-ending iqf-step-enter" data-kind={ending.kind}>
      <span className="iqf-ending-icon" aria-hidden="true">
        {waitlisted ? <Clock size={28} /> : <Check size={28} />}
      </span>
      <h2 ref={headingRef} tabIndex={-1} className="iqf-ending-title">
        {ending.title}
      </h2>
      {ending.message ? <p className="iqf-ending-text">{ending.message}</p> : null}
      {redirect.phase === "navigating" || redirect.phase === "waiting" ? (
        <p className="iqf-ending-redirect" role="status">
          <LoaderCircle size={18} className="iqf-spin" aria-hidden="true" />
          <span>{host ? `Taking you to ${host}...` : "Taking you to the next page..."}</span>
        </p>
      ) : null}
      {redirect.phase === "manual" ? (
        <>
          {previewNote ? (
            <p className="iqf-ending-text">Preview: live visitors go to this page next.</p>
          ) : null}
          <a className="iqf-btn iqf-btn-primary" href={redirect.url} target={redirect.target} rel="noopener">
            Continue
          </a>
        </>
      ) : null}
    </div>
  );
}
