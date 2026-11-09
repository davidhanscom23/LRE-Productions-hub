"use client";

export type CopyOutcome =
  /** Written and read back: the clipboard holds exactly this text. */
  | "verified"
  /** Written, but the browser does not let the page read the clipboard to check. */
  | "copied"
  /** Nothing was copied: the person has to copy by hand. */
  | "failed";

async function clipboardReadAllowed(): Promise<boolean> {
  try {
    if (!navigator.permissions?.query) return false;
    const status = await navigator.permissions.query({ name: "clipboard-read" as PermissionName });
    return status.state === "granted";
  } catch {
    // Firefox and Safari do not know "clipboard-read": never prompt just to double-check.
    return false;
  }
}

function legacyCopy(text: string, source?: HTMLTextAreaElement | HTMLInputElement | null): boolean {
  try {
    let el = source ?? null;
    let temp: HTMLTextAreaElement | null = null;
    if (!el) {
      temp = document.createElement("textarea");
      temp.value = text;
      temp.setAttribute("readonly", "");
      temp.style.position = "fixed";
      temp.style.opacity = "0";
      document.body.appendChild(temp);
      el = temp;
    }
    el.focus();
    el.select();
    const ok = document.execCommand("copy");
    if (temp) document.body.removeChild(temp);
    return ok;
  } catch {
    return false;
  }
}

/**
 * Copies text and, when the browser already allows it, reads the clipboard back to prove it.
 * Falls back to selecting `source` and the legacy copy command (insecure origins, old browsers).
 */
export async function copyWithCheck(
  text: string,
  source?: HTMLTextAreaElement | HTMLInputElement | null,
): Promise<CopyOutcome> {
  let written = false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      written = true;
    }
  } catch {
    written = false;
  }
  if (!written) return legacyCopy(text, source) ? "copied" : "failed";

  if (await clipboardReadAllowed()) {
    try {
      const back = await navigator.clipboard.readText();
      return back === text ? "verified" : "failed";
    } catch {
      return "copied";
    }
  }
  return "copied";
}
