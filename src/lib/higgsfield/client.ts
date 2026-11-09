import "server-only";

import { higgsfieldAuthHeader } from "@/lib/higgsfield/credentials";
import {
  getHiggsfieldImageModel,
  type HiggsfieldAspectRatio,
  type HiggsfieldImageModelId,
} from "@/lib/higgsfield/models";

const BASE_URL = "https://platform.higgsfield.ai";

export type HiggsfieldRequestStatus =
  | "queued"
  | "in_progress"
  | "completed"
  | "failed"
  | "nsfw"
  | "canceled"
  | "cancelled";

export type HiggsfieldStatusResult = {
  status: HiggsfieldRequestStatus | string;
  requestId: string;
  imageUrl: string | null;
  raw: Record<string, unknown>;
};

function authHeaders(): HeadersInit {
  const auth = higgsfieldAuthHeader();
  if (!auth) {
    throw new Error(
      "Higgsfield is not configured. Set HF_API_KEY and HF_API_SECRET (or HF_CREDENTIALS).",
    );
  }
  return {
    Authorization: auth,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function readError(response: Response): Promise<string> {
  const text = await response.text().catch(() => "");
  if (!text) return response.statusText || `HTTP ${response.status}`;
  try {
    const json = JSON.parse(text) as {
      detail?: string | { msg?: string }[];
      message?: string;
      error?: string;
    };
    if (typeof json.detail === "string") return json.detail;
    if (Array.isArray(json.detail)) {
      return json.detail.map((row) => row.msg || JSON.stringify(row)).join("; ");
    }
    if (json.message) return json.message;
    if (json.error) return json.error;
  } catch {
    // fall through
  }
  return text.slice(0, 400);
}

function firstImageUrl(payload: Record<string, unknown>): string | null {
  const images = payload.images;
  if (Array.isArray(images) && images.length > 0) {
    const first = images[0];
    if (typeof first === "string" && first.startsWith("http")) return first;
    if (first && typeof first === "object") {
      const url = (first as { url?: unknown }).url;
      if (typeof url === "string" && url.startsWith("http")) return url;
    }
  }

  const video = payload.video;
  if (video && typeof video === "object") {
    const url = (video as { url?: unknown }).url;
    if (typeof url === "string" && url.startsWith("http")) return url;
  }

  const jobs = payload.jobs;
  if (Array.isArray(jobs)) {
    for (const job of jobs) {
      if (!job || typeof job !== "object") continue;
      const results = (job as { results?: { raw?: { url?: string } } }).results;
      const url = results?.raw?.url;
      if (typeof url === "string" && url.startsWith("http")) return url;
    }
  }

  return null;
}

export async function submitHiggsfieldImage(input: {
  modelId: HiggsfieldImageModelId;
  prompt: string;
  aspectRatio: HiggsfieldAspectRatio;
}): Promise<{ requestId: string }> {
  const model = getHiggsfieldImageModel(input.modelId);
  if (!model) throw new Error("Unknown Higgsfield model.");

  const prompt = input.prompt.trim();
  if (prompt.length < 3) throw new Error("Prompt is too short.");
  if (prompt.length > 4000) throw new Error("Prompt is too long (max 4000).");

  const aspectRatio = model.aspectRatios.includes(input.aspectRatio)
    ? input.aspectRatio
    : model.defaultAspectRatio;

  const response = await fetch(`${BASE_URL}/${model.id}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(
      model.buildPayload({ prompt, aspectRatio }),
    ),
  });

  if (!response.ok) {
    throw new Error(`Higgsfield submit failed: ${await readError(response)}`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  const requestId =
    (typeof data.request_id === "string" && data.request_id) ||
    (typeof data.id === "string" && data.id) ||
    "";
  if (!requestId) {
    throw new Error("Higgsfield did not return a request_id.");
  }
  return { requestId };
}

export async function getHiggsfieldRequestStatus(
  requestId: string,
): Promise<HiggsfieldStatusResult> {
  const clean = requestId.trim();
  if (!clean) throw new Error("Missing request id.");

  const response = await fetch(`${BASE_URL}/requests/${clean}/status`, {
    method: "GET",
    headers: authHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Higgsfield status failed: ${await readError(response)}`);
  }

  const raw = (await response.json()) as Record<string, unknown>;
  const status = String(raw.status ?? "unknown");
  return {
    status,
    requestId: clean,
    imageUrl: firstImageUrl(raw),
    raw,
  };
}

export async function downloadHiggsfieldImage(url: string): Promise<{
  bytes: Buffer;
  contentType: string;
  extension: string;
}> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Could not download generated image (${response.status}).`);
  }
  const contentType =
    response.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
  const arrayBuffer = await response.arrayBuffer();
  const bytes = Buffer.from(arrayBuffer);
  if (bytes.length < 32) {
    throw new Error("Downloaded image was empty.");
  }

  let extension = "jpg";
  if (contentType.includes("png")) extension = "png";
  else if (contentType.includes("webp")) extension = "webp";
  else if (contentType.includes("jpeg") || contentType.includes("jpg")) {
    extension = "jpg";
  } else {
    const fromUrl = /\.([a-zA-Z0-9]+)(?:\?|$)/.exec(url);
    if (fromUrl?.[1]) extension = fromUrl[1].toLowerCase();
  }

  return { bytes, contentType, extension };
}
