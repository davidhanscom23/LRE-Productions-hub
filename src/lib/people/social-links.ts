/** Optional public profile social links stored on profiles. */
export type ProfileSocialLinks = {
  facebook_url: string | null;
  instagram_url: string | null;
  linkedin_url: string | null;
  twitter_url: string | null;
};

export const PROFILE_SOCIAL_FIELDS = [
  { key: "facebook_url", label: "Facebook", short: "Facebook" },
  { key: "instagram_url", label: "Instagram", short: "Instagram" },
  { key: "linkedin_url", label: "LinkedIn", short: "LinkedIn" },
  { key: "twitter_url", label: "X (Twitter)", short: "X" },
] as const;

export type ProfileSocialKey = (typeof PROFILE_SOCIAL_FIELDS)[number]["key"];

/** Empty string clears; otherwise must resolve to http(s). Auto-prefixes https://. */
export function normalizeOptionalHttpUrl(
  raw: string,
  label: string,
): { url: string | null; error: string | null } {
  let trimmed = raw.trim();
  if (!trimmed) return { url: null, error: null };

  // Allow pasting bare domains / paths without a scheme.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    trimmed = `https://${trimmed.replace(/^\/+/, "")}`;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return { url: null, error: `${label} must start with https://` };
    }
    if (!parsed.hostname) {
      return { url: null, error: `${label} doesn’t look like a valid link.` };
    }
    return { url: parsed.toString(), error: null };
  } catch {
    return { url: null, error: `${label} doesn’t look like a valid link.` };
  }
}

export function normalizeProfileSocialLinks(input: {
  facebook_url: string;
  instagram_url: string;
  linkedin_url: string;
  twitter_url: string;
}): { links: ProfileSocialLinks; error: string | null } {
  const facebook = normalizeOptionalHttpUrl(input.facebook_url, "Facebook URL");
  if (facebook.error) return { links: emptyLinks(), error: facebook.error };
  const instagram = normalizeOptionalHttpUrl(
    input.instagram_url,
    "Instagram URL",
  );
  if (instagram.error) return { links: emptyLinks(), error: instagram.error };
  const linkedin = normalizeOptionalHttpUrl(input.linkedin_url, "LinkedIn URL");
  if (linkedin.error) return { links: emptyLinks(), error: linkedin.error };
  const twitter = normalizeOptionalHttpUrl(
    input.twitter_url,
    "X (Twitter) URL",
  );
  if (twitter.error) return { links: emptyLinks(), error: twitter.error };

  return {
    links: {
      facebook_url: facebook.url,
      instagram_url: instagram.url,
      linkedin_url: linkedin.url,
      twitter_url: twitter.url,
    },
    error: null,
  };
}

function emptyLinks(): ProfileSocialLinks {
  return {
    facebook_url: null,
    instagram_url: null,
    linkedin_url: null,
    twitter_url: null,
  };
}

export function listProfileSocialLinks(
  profile: Partial<ProfileSocialLinks> | null | undefined,
): { key: ProfileSocialKey; label: string; short: string; url: string }[] {
  if (!profile) return [];
  return PROFILE_SOCIAL_FIELDS.flatMap((field) => {
    const url = profile[field.key]?.trim();
    if (!url) return [];
    return [{ key: field.key, label: field.label, short: field.short, url }];
  });
}
