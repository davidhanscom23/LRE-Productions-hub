"use server";

import { validateCustomerEsign } from "@/lib/av-erp/customer-esign";
import { COMPANY } from "@/lib/company";
import { sendEmailDetailed } from "@/lib/email/send";
import { textToEmailHtml } from "@/lib/honeybook/project-email";
import { buildContractPdf } from "@/lib/project-contracts/pdf";
import {
  CONTRACT_BUCKET,
  CONTRACT_TOKEN_RE,
  contractHash,
  formatDateTimeEt,
  pngFromDataUrl,
} from "@/lib/project-contracts/server";
import { createServiceClient, isServiceRoleConfigured } from "@/lib/supabase/admin";

export type SignResult = { ok: true; response: "accepted" | "declined" } | { ok: false; error: string };

export async function respondToContractAction(input: {
  token: string;
  response: "accepted" | "declined";
  signerName?: string;
  signerEmail?: string;
  signatureData?: string;
  note?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<SignResult> {
  const token = String(input.token ?? "").trim();
  if (!CONTRACT_TOKEN_RE.test(token)) return { ok: false, error: "This signing link isn't valid." };
  if (!isServiceRoleConfigured()) return { ok: false, error: "Signing isn't available right now. Please contact us." };
  const validated = validateCustomerEsign(input);
  if (!validated.ok) return validated;
  const v = validated.value;
  if (v.response === "accepted" && !pngFromDataUrl(v.signatureData)) {
    return { ok: false, error: "Please draw your signature again." };
  }

  const db = createServiceClient();
  const { data: c } = await db
    .from("project_contracts")
    .select("id, title, body, status, project_id, created_by, body_hash")
    .eq("sign_token", token)
    .maybeSingle();
  if (!c || c.status === "draft") return { ok: false, error: "This signing link isn't valid." };
  if (c.status === "signed") return { ok: false, error: "This contract has already been signed." };
  if (c.status === "declined") return { ok: false, error: "This contract was already declined." };
  if (c.status === "void") return { ok: false, error: "This contract is no longer active. Please contact us." };

  const now = new Date().toISOString();
  const hash = contractHash(String(c.title), String(c.body));

  // The status guard makes a double submit harmless: only the first update matches.
  const { data: updated } = await db
    .from("project_contracts")
    .update({
      status: v.response === "accepted" ? "signed" : "declined",
      signer_name: v.signerName,
      signer_email: v.signerEmail,
      signed_at: now,
      signature_data: v.signatureData,
      signer_ip: v.ipAddress,
      signer_user_agent: v.userAgent,
      response_note: v.note,
      body_hash: hash,
      updated_at: now,
    })
    .eq("id", c.id)
    .eq("status", "sent")
    .select("id");
  if (!updated?.length) return { ok: false, error: "This contract was already answered." };

  const { data: project } = await db.from("honeybook_projects").select("name").eq("id", c.project_id).maybeSingle();
  const projectName = String(project?.name ?? "");

  await db.from("honeybook_project_notes").insert({
    project_id: c.project_id,
    source: "system",
    category: "status",
    body:
      v.response === "accepted"
        ? `Contract "${c.title}" was signed by ${v.signerName}.`
        : `Contract "${c.title}" was declined${v.note ? `: ${v.note.slice(0, 200)}` : "."}`,
  });

  // Archive + email a stamped copy. Best effort: the signature is already saved.
  try {
    if (v.response === "accepted") {
      const bytes = await buildContractPdf({
        companyName: COMPANY.displayName,
        title: String(c.title),
        body: String(c.body),
        projectName,
        signature: {
          signerName: v.signerName,
          signerEmail: v.signerEmail,
          signedAtLabel: formatDateTimeEt(now),
          ip: v.ipAddress,
          documentHash: hash,
          png: pngFromDataUrl(v.signatureData),
        },
      });
      const path = `${c.project_id}/${c.id}.pdf`;
      const { error: upErr } = await db.storage
        .from(CONTRACT_BUCKET)
        .upload(path, bytes, { contentType: "application/pdf", upsert: false, cacheControl: "31536000" });
      if (!upErr || /already exists|Duplicate/i.test(upErr.message)) {
        await db.from("project_contracts").update({ signed_pdf_path: path }).eq("id", c.id);
      }

      const safe = String(c.title).replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 50) || "contract";
      const attachment = { filename: `${safe}-signed.pdf`, content: bytes, contentType: "application/pdf" };
      const text = `Thank you, ${v.signerName}. Your signed copy of "${c.title}" is attached for your records.\n\n--\n${COMPANY.displayName}\n${COMPANY.email}`;
      if (v.signerEmail.includes("@")) {
        await sendEmailDetailed({
          to: [v.signerEmail],
          subject: `Your signed ${c.title}`,
          text,
          html: textToEmailHtml(text),
          attachments: [attachment],
        });
      }
      const { data: creator } = c.created_by
        ? await db.from("profiles").select("email").eq("id", c.created_by).maybeSingle()
        : { data: null };
      const staffTo = String(creator?.email ?? "") || COMPANY.email;
      const staffText = `${v.signerName} signed "${c.title}"${projectName ? ` for ${projectName}` : ""}. The signed PDF is attached and saved on the project in the Hub.`;
      await sendEmailDetailed({
        to: [staffTo],
        subject: `Signed: ${c.title}${projectName ? ` (${projectName})` : ""}`,
        text: staffText,
        html: textToEmailHtml(staffText),
        attachments: [attachment],
      });
    }
  } catch (e) {
    console.error("[contract-sign] post-sign step failed", e);
  }

  return { ok: true, response: v.response };
}
