import "server-only";

/**
 * Higgsfield Cloud API credentials (platform.higgsfield.ai).
 * Prefer HF_CREDENTIALS / HF_KEY as "key:secret", or separate HF_API_KEY + HF_API_SECRET.
 */
export function getHiggsfieldCredentials(): {
  apiKey: string;
  apiSecret: string;
} | null {
  const combined =
    process.env.HF_CREDENTIALS?.trim() ||
    process.env.HF_KEY?.trim() ||
    "";
  if (combined.includes(":")) {
    const idx = combined.indexOf(":");
    const apiKey = combined.slice(0, idx).trim();
    const apiSecret = combined.slice(idx + 1).trim();
    if (apiKey && apiSecret) return { apiKey, apiSecret };
  }

  const apiKey =
    process.env.HF_API_KEY?.trim() ||
    process.env.HIGGSFIELD_API_KEY?.trim() ||
    "";
  const apiSecret =
    process.env.HF_API_SECRET?.trim() ||
    process.env.HF_SECRET?.trim() ||
    process.env.HIGGSFIELD_API_SECRET?.trim() ||
    process.env.HIGGSFIELD_SECRET?.trim() ||
    "";

  if (apiKey && apiSecret) return { apiKey, apiSecret };
  return null;
}

export function isHiggsfieldConfigured(): boolean {
  return getHiggsfieldCredentials() !== null;
}

export function higgsfieldAuthHeader(): string | null {
  const creds = getHiggsfieldCredentials();
  if (!creds) return null;
  return `Key ${creds.apiKey}:${creds.apiSecret}`;
}
