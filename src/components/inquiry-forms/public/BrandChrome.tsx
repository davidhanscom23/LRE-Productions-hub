"use client";

/**
 * Inquiry Forms public renderer - brand chrome around the form.
 * Standalone: header (logo, on a dark band when the logo is light, or a text wordmark), intro, footer with
 * the legal line, phone / email links and the privacy link. Embedded: the host page already carries the
 * brand, so only the intro and a small privacy link remain (KM Hub lesson: framed forms drop page chrome).
 */
import type { BrandProfile } from "@/lib/inquiry-forms/types";
import { safeRedirectUrl } from "@/lib/inquiry-forms/embed-protocol";

export const PREVIEW_RIBBON_TEXT = "Preview - availability checks are real, nothing is saved";

/** Root-relative ("/logo.png") or absolute http(s) image URL, else null. */
export function safeAssetUrl(url: string | null | undefined): string | null {
  if (typeof url !== "string") return null;
  const u = url.trim();
  if (u.startsWith("/") && !u.startsWith("//")) return u;
  return safeRedirectUrl(u);
}

export function telHref(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, "");
  return digits.replace(/\D/g, "").length >= 7 ? `tel:${digits}` : null;
}

export function mailHref(email: string | null | undefined): string | null {
  if (!email) return null;
  const e = email.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? `mailto:${e}` : null;
}

export function PreviewRibbon() {
  return (
    <div className="iqf-preview" role="note">
      {PREVIEW_RIBBON_TEXT}
    </div>
  );
}

export function BrandHeader({ brand }: { brand: BrandProfile }) {
  const logo = safeAssetUrl(brand.logoUrl);
  const site = safeRedirectUrl(brand.siteUrl);
  const mark = logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logo} alt={brand.name} className="iqf-logo" />
  ) : (
    <span className="iqf-wordmark">{brand.name}</span>
  );
  return (
    <header className={brand.logoOnDark ? "iqf-header iqf-header-dark" : "iqf-header"}>
      <div className="iqf-header-inner">
        {site ? (
          <a className="iqf-header-link" href={site} aria-label={`${brand.name} home`}>
            {mark}
          </a>
        ) : (
          mark
        )}
      </div>
    </header>
  );
}

export function FormIntro({
  headline,
  subheadline,
  fallbackTitle,
}: {
  headline?: string | null;
  subheadline?: string | null;
  fallbackTitle: string;
}) {
  const h = headline?.trim();
  const sub = subheadline?.trim();
  if (!h && !sub) return <h1 className="iqf-sr-only">{fallbackTitle}</h1>;
  return (
    <div className="iqf-intro">
      <h1 className={h ? "iqf-headline" : "iqf-sr-only"}>{h || fallbackTitle}</h1>
      {sub ? <p className="iqf-subheadline">{sub}</p> : null}
    </div>
  );
}

export function BrandFooter({ brand }: { brand: BrandProfile }) {
  const phone = telHref(brand.phone);
  const email = mailHref(brand.email);
  const privacy = safeRedirectUrl(brand.privacyUrl);
  const legal = brand.legalLine?.trim();
  if (!phone && !email && !privacy && !legal) return null;
  return (
    <footer className="iqf-footer">
      <div className="iqf-footer-inner">
        {phone || email || privacy ? (
          <div className="iqf-footer-links">
            {phone ? <a href={phone}>{brand.phone}</a> : null}
            {email ? <a href={email}>{brand.email}</a> : null}
            {privacy ? (
              <a href={privacy} target="_blank" rel="noopener noreferrer">
                Privacy policy
              </a>
            ) : null}
          </div>
        ) : null}
        {legal ? <p className="iqf-legal">{legal}</p> : null}
      </div>
    </footer>
  );
}

/** Embedded forms keep only the privacy link. */
export function EmbedFooter({ brand }: { brand: BrandProfile }) {
  const privacy = safeRedirectUrl(brand.privacyUrl);
  if (!privacy) return null;
  return (
    <p className="iqf-embed-links">
      <a href={privacy} target="_blank" rel="noopener noreferrer">
        Privacy policy
      </a>
    </p>
  );
}
