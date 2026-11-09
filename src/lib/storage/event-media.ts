import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { eventMediaThumbPath } from "@/lib/storage/thumb-path";

/**
 * Event media storage abstraction.
 * Default: Supabase Storage bucket `event-media`.
 * Optional Bunny Storage zone via EVENT_MEDIA_STORAGE_PROVIDER=bunny.
 *
 * Each `event_media` row stores `storage_provider` so legacy Supabase objects
 * keep working after switching new uploads to Bunny.
 */

export type StorageProvider = "supabase" | "bunny";

export const EVENT_MEDIA_BUCKET = "event-media";

export function getEventMediaStorageProvider(): StorageProvider {
  const value = process.env.EVENT_MEDIA_STORAGE_PROVIDER?.trim().toLowerCase();
  if (value === "bunny" && isBunnyConfigured()) return "bunny";
  return "supabase";
}

export function isBunnyConfigured(): boolean {
  return Boolean(
    process.env.BUNNY_STORAGE_ZONE?.trim() &&
      process.env.BUNNY_STORAGE_API_KEY?.trim() &&
      process.env.BUNNY_CDN_HOST?.trim(),
  );
}

export function bunnyPublicUrl(path: string): string {
  const host = process.env.BUNNY_CDN_HOST?.trim().replace(/\/$/, "");
  if (!host) throw new Error("BUNNY_CDN_HOST is not configured.");
  return `${host}/${path.replace(/^\//, "")}`;
}

/** Bunny CDN Token Authentication key (pull-zone security key), optional. */
export function isBunnyTokenAuthConfigured(): boolean {
  return Boolean(process.env.BUNNY_TOKEN_AUTH_KEY?.trim());
}

/**
 * Sign a Bunny CDN URL when Token Authentication is enabled on the pull zone.
 * See https://docs.bunny.net/docs/cdn-token-authentication
 */
export function bunnySignedUrl(path: string, expiresInSeconds = 3600): string {
  const base = bunnyPublicUrl(path);
  const key = process.env.BUNNY_TOKEN_AUTH_KEY?.trim();
  if (!key) return base;

  const expires = Math.floor(Date.now() / 1000) + Math.max(60, expiresInSeconds);
  const urlPath = `/${path.replace(/^\//, "")}`;
  const hashable = key + urlPath + expires;
  const token = createHash("sha256")
    .update(hashable)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  const joiner = base.includes("?") ? "&" : "?";
  return `${base}${joiner}token=${token}&expires=${expires}`;
}

function bunnyStorageHost(): string {
  const region = process.env.BUNNY_STORAGE_REGION?.trim();
  return region
    ? `${region}.storage.bunnycdn.com`
    : "storage.bunnycdn.com";
}

/** Upload bytes to Bunny Storage (server-side). */
export async function uploadToBunnyStorage(input: {
  path: string;
  bytes: Buffer | Uint8Array;
  contentType?: string;
}): Promise<{ url: string }> {
  if (!isBunnyConfigured()) {
    throw new Error(
      "Bunny is not configured. Set BUNNY_STORAGE_ZONE, BUNNY_STORAGE_API_KEY, BUNNY_CDN_HOST.",
    );
  }

  const zone = process.env.BUNNY_STORAGE_ZONE!.trim();
  const apiKey = process.env.BUNNY_STORAGE_API_KEY!.trim();
  const path = input.path.replace(/^\//, "");

  const response = await fetch(
    `https://${bunnyStorageHost()}/${zone}/${path}`,
    {
      method: "PUT",
      headers: {
        AccessKey: apiKey,
        "Content-Type": input.contentType || "application/octet-stream",
      },
      body: new Uint8Array(input.bytes),
    },
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Bunny upload failed (${response.status}): ${text || response.statusText}`,
    );
  }

  return { url: bunnyPublicUrl(path) };
}

export async function deleteFromBunnyStorage(path: string): Promise<void> {
  if (!isBunnyConfigured()) return;
  const zone = process.env.BUNNY_STORAGE_ZONE!.trim();
  const apiKey = process.env.BUNNY_STORAGE_API_KEY!.trim();
  const clean = path.replace(/^\//, "");

  await fetch(`https://${bunnyStorageHost()}/${zone}/${clean}`, {
    method: "DELETE",
    headers: { AccessKey: apiKey },
  });
}

export async function uploadEventMediaObject(input: {
  supabase: SupabaseClient;
  path: string;
  bytes: Buffer | Uint8Array;
  contentType?: string;
  /** Force a provider; defaults to current env provider. */
  provider?: StorageProvider;
}): Promise<{ provider: StorageProvider; url: string | null; error: string | null }> {
  const provider = input.provider ?? getEventMediaStorageProvider();
  const path = input.path.replace(/^\//, "");

  if (provider === "bunny") {
    try {
      const { url } = await uploadToBunnyStorage({
        path,
        bytes: input.bytes,
        contentType: input.contentType,
      });
      return { provider: "bunny", url, error: null };
    } catch (err) {
      return {
        provider: "bunny",
        url: null,
        error: err instanceof Error ? err.message : "Bunny upload failed.",
      };
    }
  }

  const { error } = await input.supabase.storage
    .from(EVENT_MEDIA_BUCKET)
    .upload(path, input.bytes, {
      upsert: false,
      contentType: input.contentType,
      cacheControl: "3600",
    });

  if (error) {
    return { provider: "supabase", url: null, error: error.message };
  }

  return { provider: "supabase", url: null, error: null };
}

export async function deleteEventMediaObject(input: {
  supabase: SupabaseClient;
  path: string;
  provider?: StorageProvider | null;
}): Promise<void> {
  const path = input.path.replace(/^\//, "");
  const provider =
    input.provider === "bunny" || input.provider === "supabase"
      ? input.provider
      : getEventMediaStorageProvider();

  if (provider === "bunny") {
    await deleteFromBunnyStorage(path);
    return;
  }

  // Remove the grid thumbnail (if any) along with the original.
  await input.supabase.storage
    .from(EVENT_MEDIA_BUCKET)
    .remove([path, eventMediaThumbPath(path)]);
}

/**
 * Signed URL for the small grid thumbnail (`<path>.thumb.jpg`).
 * Returns { url: null } when no thumbnail exists (legacy uploads, videos,
 * Bunny-hosted media) so callers can fall back to the full-size URL.
 */
export async function getEventMediaThumbAccessUrl(input: {
  supabase: SupabaseClient;
  path: string;
  provider?: StorageProvider | null;
  expiresIn?: number;
}): Promise<{ url: string | null }> {
  const path = input.path.replace(/^\//, "");
  if (!path) return { url: null };
  if (input.provider === "bunny") return { url: null };

  const { data, error } = await input.supabase.storage
    .from(EVENT_MEDIA_BUCKET)
    .createSignedUrl(eventMediaThumbPath(path), input.expiresIn ?? 86400);
  if (!error && data?.signedUrl) return { url: data.signedUrl };
  return { url: null };
}

/**
 * Public/fetchable URL for Meta, Drive, galleries, etc.
 * Bunny rows use the CDN URL; Supabase rows use a signed URL.
 */
export async function getEventMediaAccessUrl(input: {
  supabase: SupabaseClient;
  path: string;
  provider?: StorageProvider | null;
  expiresIn?: number;
}): Promise<{ url: string | null; error: string | null }> {
  const path = input.path.replace(/^\//, "");
  const provider: StorageProvider =
    input.provider === "bunny" || input.provider === "supabase"
      ? input.provider
      : "supabase";

  if (provider === "bunny") {
    if (!isBunnyConfigured()) {
      return { url: null, error: "Bunny is not configured for this media." };
    }
    // Prefer signed CDN URLs when Token Auth is configured (needed for private
    // expense receipts and recommended for any sensitive path).
    const expiresIn = input.expiresIn ?? 3600;
    if (isBunnyTokenAuthConfigured() || /(^|\/)expenses\//.test(path)) {
      try {
        return {
          url: bunnySignedUrl(path, expiresIn),
          error: null,
        };
      } catch (err) {
        return {
          url: null,
          error:
            err instanceof Error
              ? err.message
              : "Could not sign Bunny media URL.",
        };
      }
    }
    return { url: bunnyPublicUrl(path), error: null };
  }

  const { data, error } = await input.supabase.storage
    .from(EVENT_MEDIA_BUCKET)
    .createSignedUrl(path, input.expiresIn ?? 3600);
  if (!error && data?.signedUrl) {
    return { url: data.signedUrl, error: null };
  }
  return {
    url: null,
    error: error?.message ?? "Could not create a media access URL.",
  };
}
