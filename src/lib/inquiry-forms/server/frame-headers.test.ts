// @vitest-environment node
/**
 * The Inquiry Forms admin pages must never render inside another site's frame: the brand sites that
 * embed the form are same-site with the hub, so the hub's Lax session cookies reach a frame they make
 * (clickjacking Publish, Pause, Delete). The public /inquire pages stay framable for the embed.
 */
import { describe, expect, it } from "vitest";
import nextConfig from "../../../../next.config";

async function headersFor(path: string): Promise<Record<string, string>> {
  const rules = (await nextConfig.headers?.()) ?? [];
  const out: Record<string, string> = {};
  for (const rule of rules) {
    const re = new RegExp(`^${rule.source.replace(/:path\*/g, ".*").replace(/\//g, "\/")}$`);
    if (re.test(path)) for (const h of rule.headers) out[h.key.toLowerCase()] = h.value;
  }
  return out;
}

describe("frame headers", () => {
  it("lets only the hub itself frame the Inquiry Forms admin pages", async () => {
    for (const path of ["/inquiry-forms", "/inquiry-forms/abc", "/inquiry-forms/abc/settings"]) {
      const h = await headersFor(path);
      expect(h["content-security-policy"], path).toBe("frame-ancestors 'self'");
      expect(h["x-frame-options"], path).toBe("SAMEORIGIN");
    }
  });

  it("leaves the public form and embed.js framable", async () => {
    for (const path of ["/inquire/check-your-date", "/inquire/embed.js"]) {
      const h = await headersFor(path);
      expect(h["content-security-policy"], path).toBeUndefined();
      expect(h["x-frame-options"], path).toBeUndefined();
    }
  });
});
