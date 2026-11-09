import "server-only";

/**
 * Minimal Zoom Server-to-Server OAuth client.
 * Env: ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET.
 * Used to fetch the host's Personal Meeting Room (PMI) join link for huddles.
 */

let cachedToken: { token: string; expiresAt: number } | null = null;

export function isZoomConfigured(): boolean {
  return Boolean(
    process.env.ZOOM_ACCOUNT_ID &&
      process.env.ZOOM_CLIENT_ID &&
      process.env.ZOOM_CLIENT_SECRET,
  );
}

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.token;
  }
  const accountId = process.env.ZOOM_ACCOUNT_ID!;
  const clientId = process.env.ZOOM_CLIENT_ID!;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET!;
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    },
  );
  if (!res.ok) {
    throw new Error(`Zoom token request failed: ${res.status}`);
  }
  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  cachedToken = {
    token: data.access_token,
    expiresAt: now + (data.expires_in ?? 3600) * 1000,
  };
  return data.access_token;
}

/** Exposed for other Zoom API calls (e.g. cloud recordings). */
export async function getZoomAccessToken(): Promise<string> {
  return getAccessToken();
}

export type ZoomPmiInfo = {
  joinUrl: string;
  startUrl: string;
  topic: string;
};

/** The host's Personal Meeting Room join + host-start links. */
export async function getPmiJoinInfo(): Promise<ZoomPmiInfo> {
  const token = await getAccessToken();
  const headers = { Authorization: `Bearer ${token}` };

  // Server-to-Server OAuth has no "me"; prefer the configured host email.
  const host = process.env.ZOOM_HOST_EMAIL?.trim() || "me";
  const meRes = await fetch(
    `https://api.zoom.us/v2/users/${encodeURIComponent(host)}`,
    { headers },
  );
  if (!meRes.ok) throw new Error(`Zoom /users/${host} failed: ${meRes.status}`);
  const me = (await meRes.json()) as {
    pmi?: number;
    personal_meeting_url?: string;
  };

  if (!me.pmi) {
    const url = me.personal_meeting_url ?? "";
    return { joinUrl: url, startUrl: url, topic: "Team Huddle" };
  }

  const mtgRes = await fetch(`https://api.zoom.us/v2/meetings/${me.pmi}`, {
    headers,
  });
  if (!mtgRes.ok) {
    const url = me.personal_meeting_url ?? `https://zoom.us/j/${me.pmi}`;
    return { joinUrl: url, startUrl: url, topic: "Team Huddle" };
  }
  const mtg = (await mtgRes.json()) as {
    join_url?: string;
    start_url?: string;
    topic?: string;
  };
  return {
    joinUrl:
      mtg.join_url ?? me.personal_meeting_url ?? `https://zoom.us/j/${me.pmi}`,
    startUrl: mtg.start_url ?? mtg.join_url ?? "",
    topic: mtg.topic ?? "Team Huddle",
  };
}
