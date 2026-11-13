import "server-only";

import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { COMPANY } from "@/lib/company";
import { CHAT_MODEL, isAiConfigured } from "@/lib/kb";
import {
  PLATFORM_CAPTION_GUIDANCE,
  SOCIAL_PLATFORM_LABELS,
  SOCIAL_PLATFORMS,
  type SocialPlatform,
} from "@/lib/social/platforms";

export type CaptionPacketContext = {
  clientName: string;
  venue: string;
  eventDate: string;
  eventType: string;
  djName: string;
  memorableMoment: string;
  clientFeedback: string;
  /** Website / spreadsheet testimonials matched by Event ID. */
  websiteReviews?: string;
  issues: string;
};

export type GeneratedCaptions = Record<SocialPlatform, string>;

function eventFactsBlock(context: CaptionPacketContext): string {
  return `Event facts (use only these; do not invent clients, venues, or moments):
- Client: ${context.clientName || "(not provided)"}
- Venue / location: ${context.venue || "(not provided)"}
- Date: ${context.eventDate || "(not provided)"}
- Event type: ${context.eventType || "(not provided)"}
- Team member / staff: ${context.djName || "(not provided)"}
- Memorable moment: ${context.memorableMoment || "(none)"}
- Client feedback (staff notes): ${context.clientFeedback || "(none)"}
- Website / Google reviews (real quotes — weave in naturally when present; paraphrase lightly if needed; never invent reviews): ${context.websiteReviews || "(none)"}
- Internal notes (use only if they add a tasteful public story beat; never quote problems verbatim): ${context.issues || "(none)"}

Do NOT mention hours worked, shift length, clocks, overtime, staffing hours, or any payroll/schedule duration — those facts are never part of captions even if present on the packet.`;
}

const SEO_AEO_RULES = `Local SEO + AI/answer-engine (AEO) rules — apply on every platform:
- Make who / what / where obvious in natural language: brand (${COMPANY.displayName}), service (event production), venue, and city/area when known.
- Prefer clear named entities over vague phrases ("wedding production team at [Venue] in [City]" beats "great night with the team").
- Write so a search snippet or AI overview could quote a useful sentence without guessing missing place or service details.
- No keyword stuffing, no fake cities, no invented reviews or awards.
- Respect client privacy — do not overshare personal details from feedback.
- Maximize each platform's own best practices from the guidance below (length, tone, hashtags, CTA style).`;

function buildPrompt(context: CaptionPacketContext): string {
  const guidance = SOCIAL_PLATFORMS.map(
    (platform) =>
      `- ${platform} (${SOCIAL_PLATFORM_LABELS[platform]}): ${PLATFORM_CAPTION_GUIDANCE[platform]}`,
  ).join("\n");

  return `Create platform-native social captions for a premium event-production company event post. Maximize each network's best practices and optimize for local SEO and AI/answer-engine visibility.

Brand: ${COMPANY.displayName}
Handle: ${COMPANY.socialHandle}
Website: ${COMPANY.website}
Service area: use the event venue's location when it is obvious; do not invent a city.

${eventFactsBlock(context)}

${SEO_AEO_RULES}

Platform guidance:
${guidance}

Return ONLY valid JSON with ALL of these keys (every key required, none empty): ${SOCIAL_PLATFORMS.join(", ")}.
Each value is the full caption string ready to paste (include hashtags in the caption where appropriate for that platform).
You MUST include non-empty captions for threads and pinterest as well as the other platforms.
For youtube, the first line must be the video title; the rest is the description.
Do not wrap in markdown fences.`;
}

function buildMissingPrompt(
  context: CaptionPacketContext,
  missing: SocialPlatform[],
): string {
  const guidance = missing
    .map(
      (platform) =>
        `- ${platform} (${SOCIAL_PLATFORM_LABELS[platform]}): ${PLATFORM_CAPTION_GUIDANCE[platform]}`,
    )
    .join("\n");

  return `Write social captions for ONLY these platforms (the others already exist). Maximize each platform's best practices and local SEO + AI/answer-engine clarity.

Brand: ${COMPANY.displayName}
Handle: ${COMPANY.socialHandle}
Website: ${COMPANY.website}

${eventFactsBlock(context)}

${SEO_AEO_RULES}

Platform guidance:
${guidance}

Return ONLY valid JSON with keys: ${missing.join(", ")}.
Every key must be a non-empty caption string. Do not wrap in markdown fences.`;
}

function emptyCaptions(): GeneratedCaptions {
  return Object.fromEntries(
    SOCIAL_PLATFORMS.map((platform) => [platform, ""]),
  ) as GeneratedCaptions;
}

function parseCaptions(raw: string): GeneratedCaptions {
  const result = emptyCaptions();
  const trimmed = raw.trim().replace(/^```json\s*/i, "").replace(/```$/i, "");
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    for (const platform of SOCIAL_PLATFORMS) {
      const value = parsed[platform];
      if (typeof value === "string" && value.trim()) {
        result[platform] = value.trim();
      }
    }
  } catch {
    // fall through — caller will error if empty
  }
  return result;
}

async function generateOnce(
  prompt: string,
): Promise<{ text: string; error: string | null }> {
  try {
    const res = await generateText({
      model: openai(CHAT_MODEL),
      system:
        "You are a senior social media strategist for a premium event-production company. Write captions that follow each platform's best practices and are optimized for local SEO and answer engines (clear brand + place + service entities, natural language, no stuffing). Never invent facts. Never mention hours worked or shift length. Respect client privacy. Always return every requested JSON key with a non-empty caption.",
      prompt,
      temperature: 0.55,
    });
    return { text: res.text, error: null };
  } catch (error) {
    return {
      text: "",
      error:
        error instanceof Error ? error.message : "Caption generation failed.",
    };
  }
}

export async function generateSocialCaptions(
  context: CaptionPacketContext,
): Promise<{ captions: GeneratedCaptions | null; error: string | null }> {
  if (!isAiConfigured()) {
    return {
      captions: null,
      error: "OpenAI is not configured (OPENAI_API_KEY).",
    };
  }

  const first = await generateOnce(buildPrompt(context));
  if (first.error) {
    return { captions: null, error: first.error };
  }

  const captions = parseCaptions(first.text);
  let missing = SOCIAL_PLATFORMS.filter((p) => !captions[p]);

  // Second pass for any platforms the model omitted (common for newly added ones).
  if (missing.length > 0 && missing.length < SOCIAL_PLATFORMS.length) {
    const retry = await generateOnce(buildMissingPrompt(context, missing));
    if (!retry.error) {
      const filled = parseCaptions(retry.text);
      for (const platform of missing) {
        if (filled[platform]) captions[platform] = filled[platform];
      }
      missing = SOCIAL_PLATFORMS.filter((p) => !captions[p]);
    }
  }

  if (missing.length === SOCIAL_PLATFORMS.length) {
    return {
      captions: null,
      error: "Could not parse caption JSON from the model. Try again.",
    };
  }

  return { captions, error: null };
}
