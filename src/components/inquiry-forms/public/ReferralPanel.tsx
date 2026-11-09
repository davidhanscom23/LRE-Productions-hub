"use client";

/**
 * Inquiry Forms public renderer - referral links shown when the location check fails and the form's
 * onLocationFail action is "referral". Links open in a new tab (rel noopener noreferrer) and must be
 * absolute http(s). Never renders an empty list: with no usable link the caller shows nothing.
 */
import { ExternalLink } from "lucide-react";
import type { PublicFormSettings } from "@/lib/inquiry-forms/types";
import { safeRedirectUrl } from "@/lib/inquiry-forms/embed-protocol";

type Referral = NonNullable<PublicFormSettings["referral"]>;

export function usableReferralLinks(referral: PublicFormSettings["referral"]): { label: string; url: string }[] {
  if (!referral || !Array.isArray(referral.links)) return [];
  const out: { label: string; url: string }[] = [];
  for (const link of referral.links) {
    const url = safeRedirectUrl(link?.url);
    const label = typeof link?.label === "string" ? link.label.trim() : "";
    if (url && label) out.push({ label, url });
  }
  return out;
}

export function ReferralPanel({ referral }: { referral: Referral }) {
  const links = usableReferralLinks(referral);
  if (links.length === 0) return null;
  return (
    <section className="iqf-referral" aria-labelledby="iqf-referral-title">
      <h3 id="iqf-referral-title" className="iqf-referral-title">
        {referral.title?.trim() || "Teams we trust in your area"}
      </h3>
      {referral.message?.trim() ? <p className="iqf-referral-text">{referral.message}</p> : null}
      <ul className="iqf-referral-links">
        {links.map((l) => (
          <li key={`${l.label}-${l.url}`}>
            <a href={l.url} target="_blank" rel="noopener noreferrer">
              {l.label}
              <ExternalLink size={16} aria-hidden="true" />
              <span className="iqf-sr-only"> (opens in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
