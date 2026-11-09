import "server-only";

/**
 * Inquiry Forms - what the public page renders. A server projection: notify recipients, the
 * confirmation email setup, secrets and business internals never reach the browser.
 */
import { createServiceClient } from "@/lib/supabase/admin";
import { isValidSlug } from "../slug";
import type { PublicFormBundle } from "../types";
import { hubAdapter } from "./adapter";
import { draftPreviewState, projectPublicSettings, resolveBrand } from "./bundle-core";
import { loadFormBySlug, loadVersion, resolveForm, type FormRecord, type ResolvedForm } from "./db";
import { getBusinessSettings } from "./settings";
import { turnstileSiteKey } from "./spam";

async function project(
  form: FormRecord,
  resolved: ResolvedForm,
  versionId: string | null,
  preview: boolean,
): Promise<PublicFormBundle> {
  const sb = createServiceClient();
  const business = await getBusinessSettings(sb);
  const settings = projectPublicSettings(resolved.settings);
  return {
    formId: form.id,
    slug: form.slug,
    name: form.name,
    versionId,
    definition: resolved.definition,
    settings,
    brand: resolveBrand(hubAdapter.brands, resolved.settings.brand || form.brand, hubAdapter.defaultBrand),
    turnstileSiteKey: turnstileSiteKey(business),
    preview,
  };
}

/**
 * The live, published form for /inquire/<slug>. null when the slug is unknown, the form is not
 * live, has no published version, or the stored definition is not valid. Throws on DB errors
 * (the page shows its error state instead of a misleading "not found").
 */
export async function loadPublicBundle(slug: string): Promise<PublicFormBundle | null> {
  if (typeof slug !== "string" || !isValidSlug(slug)) return null;
  const sb = createServiceClient();
  const form = await loadFormBySlug(sb, slug);
  if (!form || form.status !== "live" || !form.published_version_id) return null;
  const version = await loadVersion(sb, form.published_version_id);
  if (!version) return null;
  const resolved = resolveForm(version.definition, version.settings);
  if (!resolved) return null;
  return project(form, resolved, version.id, false);
}

/** ?preview=draft: the draft as a form, or the problems a draft was saved with. */
export type DraftPreview =
  | { ok: true; bundle: PublicFormBundle }
  | { ok: false; formId: string; name: string; slug: string; issues: string[] };

/**
 * The DRAFT (any status) for an admin dry run (?preview=draft). null unless the caller is a real
 * admin, or when the slug is unknown. Drafts can be saved with problems: one that does not pass
 * validateDefinition comes back as its list of problems (the page shows them to the admin instead
 * of a broken form).
 */
export async function loadDraftBundle(slug: string): Promise<DraftPreview | null> {
  if (typeof slug !== "string" || !isValidSlug(slug)) return null;
  const admin = await hubAdapter.currentAdmin();
  if (!admin) return null;
  const sb = createServiceClient();
  const form = await loadFormBySlug(sb, slug);
  if (!form) return null;
  const state = draftPreviewState(form.definition, form.settings);
  if (!state.ok) return { ok: false, formId: form.id, name: form.name, slug: form.slug, issues: state.issues };
  return { ok: true, bundle: await project(form, { definition: state.definition, settings: state.settings }, null, true) };
}
