import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { PublicFormBundle } from "@/lib/inquiry-forms/types";
import { isValidSlug } from "@/lib/inquiry-forms/slug";
import { todayInTz } from "@/lib/inquiry-forms/dates";
import { loadDraftBundle, loadPublicBundle } from "@/lib/inquiry-forms/server/bundle";
import { hubAdapter } from "@/lib/inquiry-forms/server/adapter";
import { FormRenderer } from "@/components/inquiry-forms/public/FormRenderer";
import { DraftIssues } from "@/components/inquiry-forms/public/DraftIssues";

/**
 * Public inquiry form: /inquire/<slug>
 * - `?embed=1`: rendered inside the iframe that /inquire/embed.js creates (no page chrome, height
 *   reporting, host messages).
 * - `?preview=draft`: the DRAFT definition as a dry run, for a real admin only (anyone else gets the
 *   404). Availability checks are real, nothing is saved. A draft saved with problems shows the
 *   admin its list of problems instead of a broken form.
 * The bundle is a server projection (no notify recipients, no secrets). Never indexed.
 */

type SearchParams = Record<string, string | string[] | undefined>;

interface InquirePageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
}

type PageData =
  | { kind: "form"; bundle: PublicFormBundle }
  | { kind: "draft-issues"; formId: string; name: string; issues: string[] };

function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** One load per request, shared by generateMetadata and the page. */
const getPageData = cache(async (slug: string, wantsDraft: boolean): Promise<PageData | null> => {
  if (!isValidSlug(slug)) return null;
  if (wantsDraft) {
    const admin = await hubAdapter.currentAdmin();
    if (!admin) return null;
    const draft = await loadDraftBundle(slug);
    if (!draft) return null;
    return draft.ok
      ? { kind: "form", bundle: { ...draft.bundle, preview: true } }
      : { kind: "draft-issues", formId: draft.formId, name: draft.name, issues: draft.issues };
  }
  const bundle = await loadPublicBundle(slug);
  // A public load is never a dry run, whatever the loader says.
  return bundle ? { kind: "form", bundle: { ...bundle, preview: false } } : null;
});

const ROBOTS = { index: false, follow: false, nocache: true } as const;

export async function generateMetadata({ params, searchParams }: InquirePageProps): Promise<Metadata> {
  const { slug } = await params;
  const query = await searchParams;
  const data = await getPageData(slug, firstParam(query.preview) === "draft");
  if (!data) return { title: "Form not available", robots: ROBOTS };
  if (data.kind === "draft-issues") return { title: `Draft needs fixes - ${data.name}`, robots: ROBOTS };
  const { bundle } = data;
  const description =
    bundle.settings.subheadline?.trim() || `Send ${bundle.brand.name} the details of your event.`;
  return {
    title: `${bundle.name} - ${bundle.brand.name}`,
    description,
    robots: ROBOTS,
  };
}

export default async function InquirePage({ params, searchParams }: InquirePageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const embed = firstParam(query.embed) === "1";
  const data = await getPageData(slug, firstParam(query.preview) === "draft");
  if (!data) notFound();
  if (data.kind === "draft-issues") {
    return <DraftIssues formId={data.formId} name={data.name} issues={data.issues} embed={embed} />;
  }
  return <FormRenderer bundle={data.bundle} embed={embed} today={todayInTz()} />;
}
