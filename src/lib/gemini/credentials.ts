import "server-only";

/**
 * Google Gemini API key (AI Studio / Generative Language API).
 * Used for Nano Banana Pro image generation in Social Studio.
 */
export function getGeminiCredentials(): { apiKey: string } | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim() || "";
  if (!apiKey) return null;
  return { apiKey };
}

export function isGeminiConfigured(): boolean {
  return getGeminiCredentials() !== null;
}
