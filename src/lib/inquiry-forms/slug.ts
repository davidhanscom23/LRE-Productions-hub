/**
 * Inquiry Forms - public form slugs (`/inquire/<slug>`).
 *
 * PURE module. The migration's CHECK on inquiry_forms.slug must use the same rule as isValidSlug:
 * ^[a-z0-9]+(-[a-z0-9]+)*$ and 3..60 characters.
 */

export const SLUG_MIN_LENGTH = 3;
export const SLUG_MAX_LENGTH = 60;
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Letters that NFKD does not decompose into an ASCII base letter. */
const EXTRA_FOLDS: Record<string, string> = {
  ß: "ss",
  æ: "ae",
  Æ: "AE",
  œ: "oe",
  Œ: "OE",
  ø: "o",
  Ø: "O",
  đ: "d",
  Đ: "D",
  ł: "l",
  Ł: "L",
  þ: "th",
  Þ: "TH",
  ð: "d",
  Ð: "D",
};

/** "Quinceañera Ñ ß" -> "Quinceanera N ss": strips accents so labels and names make readable ASCII ids. */
export function asciiFold(input: string): string {
  if (typeof input !== "string") return "";
  return input
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[ßæÆœŒøØđĐłŁþÞðÐ]/g, (c) => EXTRA_FOLDS[c] ?? c);
}

/** True for a slug the public route and the DB CHECK accept. */
export function isValidSlug(s: string): boolean {
  return (
    typeof s === "string" &&
    s.length >= SLUG_MIN_LENGTH &&
    s.length <= SLUG_MAX_LENGTH &&
    SLUG_PATTERN.test(s)
  );
}

/**
 * "Check Your Date" -> "check-your-date", "Book Our Band" -> "book-our-band".
 * Always returns a valid slug: too short results get a "form-" prefix, an empty name gives "form".
 * Uniqueness against existing forms is the caller's job (append "-2", "-3"... and re-check).
 */
export function slugFromName(name: string): string {
  let s = asciiFold(typeof name === "string" ? name : "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (s.length > SLUG_MAX_LENGTH) s = s.slice(0, SLUG_MAX_LENGTH).replace(/-+$/g, "");
  if (s.length < SLUG_MIN_LENGTH) s = s ? `form-${s}` : "form";
  return s;
}
