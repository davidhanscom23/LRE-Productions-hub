import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { siteOrigin } from "@/lib/stripe/server";
import { createServiceClient, isServiceRoleConfigured } from "@/lib/supabase/admin";

export const CONTRACT_BUCKET = "project-contracts";
export const CONTRACT_TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;

export function newContractToken(): string {
  return randomBytes(24).toString("base64url");
}

export function contractSignUrl(token: string): string {
  return `${siteOrigin()}/sign/${token}`;
}

/** Fingerprint of exactly what the client agrees to. */
export function contractHash(title: string, body: string): string {
  return createHash("sha256").update(`${title}\n${body}`, "utf8").digest("hex");
}

export function formatDateLong(d: string | null | undefined): string {
  if (!d) return "";
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", day: "numeric", year: "numeric" }).format(
    new Date(`${d.slice(0, 10)}T00:00:00Z`),
  );
}

export function formatDateTimeEt(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(iso)) + " ET";
}

/** PNG bytes from a "data:image/png;base64,..." URL, or null. */
export function pngFromDataUrl(dataUrl: string | null | undefined): Uint8Array | null {
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl ?? "");
  return m ? new Uint8Array(Buffer.from(m[1], "base64")) : null;
}

export type PublicContract = {
  id: string;
  title: string;
  body: string;
  status: "draft" | "sent" | "signed" | "declined" | "void";
  projectName: string;
  clientName: string;
  clientEmail: string;
  signerName: string;
  signedAt: string | null;
};

export async function loadPublicContract(token: string): Promise<PublicContract | null> {
  if (!CONTRACT_TOKEN_RE.test(token) || !isServiceRoleConfigured()) return null;
  const db = createServiceClient();
  const { data: c } = await db
    .from("project_contracts")
    .select("id, title, body, status, project_id, signer_name, signed_at")
    .eq("sign_token", token)
    .maybeSingle();
  // Drafts are never public.
  if (!c || c.status === "draft") return null;
  const { data: p } = await db.from("honeybook_projects").select("name, client_id").eq("id", c.project_id).maybeSingle();
  let clientName = "";
  let clientEmail = "";
  if (p?.client_id) {
    const { data: cl } = await db.from("honeybook_clients").select("full_name, email").eq("id", p.client_id).maybeSingle();
    clientName = String(cl?.full_name ?? "");
    clientEmail = String(cl?.email ?? "");
  }
  return {
    id: c.id as string,
    title: String(c.title),
    body: String(c.body),
    status: c.status as PublicContract["status"],
    projectName: String(p?.name ?? ""),
    clientName,
    clientEmail,
    signerName: String(c.signer_name ?? ""),
    signedAt: (c.signed_at as string | null) ?? null,
  };
}
