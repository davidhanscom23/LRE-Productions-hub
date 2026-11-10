"use server";

import { getCurrentProfile } from "@/lib/auth/profile";
import { canAccessHoneyBook, canEditHoneyBookProject, canManageHoneyBookCrm } from "@/lib/honeybook/access";
import {
  MAX_EMAIL_BODY,
  parseRecipients,
  textToEmailHtml,
} from "@/lib/honeybook/project-email";
import { isEmailConfigured, sendEmailDetailed } from "@/lib/email/send";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type Result = { error: string | null; sentTo?: string[] };

/** Email the client from a project card. Reply-To is the sender, and the send is logged in the project trail. */
export async function sendProjectEmailAction(input: {
  projectId: string;
  to: string;
  subject: string;
  body: string;
}): Promise<Result> {
  if (!/^[0-9a-f-]{36}$/i.test(input.projectId)) return { error: "Project not found." };
  const subject = input.subject.trim().slice(0, 200);
  const body = input.body.trim();
  if (!subject) return { error: "Add a subject." };
  if (!body) return { error: "Write a message first." };
  if (body.length > MAX_EMAIL_BODY) return { error: `Keep the message under ${MAX_EMAIL_BODY} characters.` };
  const { valid, invalid } = parseRecipients(input.to);
  if (invalid.length) return { error: `These don't look like email addresses: ${invalid.join(", ")}` };
  if (!valid.length) return { error: "Add at least one recipient." };
  if (valid.length > 5) return { error: "Send to five people or fewer at a time." };

  const profile = await getCurrentProfile();
  if (!profile) return { error: "Sign in first." };
  if (!canAccessHoneyBook(profile.role)) return { error: "Only admins, Leads, and staff can email clients." };

  const supabase = await createClient();
  const { data: assignees } = await supabase
    .from("honeybook_project_assignees")
    .select("profile_id")
    .eq("project_id", input.projectId);
  const ids = (assignees ?? []).map((r) => r.profile_id as string);
  if (!canManageHoneyBookCrm(profile.role) && !canEditHoneyBookProject(profile.role, ids, profile.id)) {
    return { error: "Only admins, Leads, and people assigned to this project can email its client." };
  }
  if (!isEmailConfigured()) {
    return { error: "Email isn't set up yet. An admin needs to add RESEND_API_KEY and EMAIL_FROM in Vercel." };
  }

  const signature = `\n\n--\n${profile.full_name ?? "LRE Productions"}\nLRE Productions`;
  const hasSignature = /vident productions\s*$/i.test(body);
  const text = hasSignature ? body : body + signature;
  const result = await sendEmailDetailed({
    to: valid,
    subject,
    text,
    html: textToEmailHtml(text),
    replyTo: profile.email || null,
  });
  if (!result.ok) return { error: result.error ?? "The email didn't send." };

  const preview = body.replace(/\s+/g, " ").slice(0, 280);
  await supabase.from("honeybook_project_notes").insert({
    project_id: input.projectId,
    author_id: profile.id,
    source: "manual",
    category: "email",
    body: `Emailed ${valid.join(", ")}: "${subject}" — ${preview}${body.length > 280 ? "…" : ""}`,
  });
  revalidatePath(`/honeybook/projects/${input.projectId}`);
  return { error: null, sentTo: valid };
}
