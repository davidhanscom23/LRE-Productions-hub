/**
 * Inquiry Forms - public projection and settings layering. PURE.
 *
 * The public bundle is a server projection: notify recipients, the confirmation email setup and
 * business internals never reach the browser.
 */
import { mergeFormSettings } from "../defaults";
import { validateDefinition } from "../definition";
import type { BrandProfile, FormDefinition, FormSettings, PublicFormSettings } from "../types";

/**
 * What ?preview=draft shows for a stored draft: the form, or (drafts may be saved with problems)
 * the problems that keep it from rendering. Settings never block a preview: they are merged with
 * the defaults, so the form always has usable copy.
 */
export function draftPreviewState(
  definition: unknown,
  settings: unknown,
): { ok: true; definition: FormDefinition; settings: FormSettings } | { ok: false; issues: string[] } {
  const checked = validateDefinition(definition);
  if (!checked.ok) return { ok: false, issues: checked.errors };
  return { ok: true, definition: checked.def, settings: mergeFormSettings(settings) };
}

/** FormSettings minus the server-only parts (notify, confirmationEmail, ownerByEventType, copies). */
export function projectPublicSettings(settings: FormSettings): PublicFormSettings {
  // Destructure the server-only keys away so a new server-only key is never copied by accident
  // through a spread of the whole object.
  const { notify, confirmationEmail, ownerByEventType, copies, ...rest } = settings;
  void notify;
  void confirmationEmail;
  void ownerByEventType;
  void copies;
  return rest;
}

/** The brand by key, else the default brand, else the first brand. */
export function resolveBrand(brands: BrandProfile[], key: string | null | undefined, fallbackKey: string): BrandProfile {
  const wanted = (key ?? "").trim();
  return (
    brands.find((b) => b.key === wanted) ??
    brands.find((b) => b.key === fallbackKey) ??
    brands[0] ?? {
      key: fallbackKey,
      name: "Inquiry",
      logoUrl: null,
      logoOnDark: false,
      siteUrl: null,
      privacyUrl: null,
      phone: null,
      email: null,
      accentColor: "#1d4ed8",
      legalLine: null,
    }
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Deep merge of plain objects: `override` wins, arrays and scalars replace, nested objects merge.
 * undefined in the override keeps the base value. Prototype keys are never copied.
 */
export function layerSettings(base: unknown, override: unknown): unknown {
  if (!isPlainObject(override)) return override === undefined ? base : override;
  if (!isPlainObject(base)) return layerSettings({}, override);
  const out: Record<string, unknown> = { ...base };
  for (const key of Object.keys(override)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
    const value = override[key];
    if (value === undefined) continue;
    out[key] = isPlainObject(value) ? layerSettings(isPlainObject(out[key]) ? out[key] : {}, value) : value;
  }
  return out;
}

/** Recursive partial for preset overrides (arrays replace whole). */
export type DeepPartial<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;
