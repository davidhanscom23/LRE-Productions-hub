import { ContractorPayClient } from "@/components/contractor-pay/contractor-pay-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getEventMediaAccessUrl } from "@/lib/storage/event-media";
import { createClient } from "@/lib/supabase/server";
import {
  currentTaxYear,
  type Contractor1099Ack,
  type ContractorPaymentRequest,
  type ContractorW9File,
} from "@/lib/types/contractor-pay";
import { redirect } from "next/navigation";

function mapPayment(
  r: Record<string, unknown>,
  name?: string,
): ContractorPaymentRequest {
  const hoursRaw = r.hours;
  let hours: number | null = null;
  if (hoursRaw !== null && hoursRaw !== undefined && hoursRaw !== "") {
    const n = Number(hoursRaw);
    hours = Number.isFinite(n) ? n : null;
  }
  return {
    id: String(r.id),
    user_id: String(r.user_id),
    amount: Number(r.amount) || 0,
    category: (r.category as ContractorPaymentRequest["category"]) ?? "other",
    description: (r.description as string) ?? "",
    work_date: (r.work_date as string) ?? "",
    event_name: (r.event_name as string) ?? "",
    hours,
    status: (r.status as ContractorPaymentRequest["status"]) ?? "pending",
    paid_at: (r.paid_at as string) ?? null,
    review_note: (r.review_note as string) ?? "",
    created_at: (r.created_at as string) ?? "",
    ...(name ? { requester_name: name } : {}),
  };
}

export default async function ContractorPayPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role === "guest") redirect("/");

  const supabase = await createClient();
  const isAdmin = profile.role === "admin";
  const taxYear = currentTaxYear();

  const { data: myRows, error } = await supabase
    .from("contractor_payment_requests")
    .select("*")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
        <p className="font-semibold">Contractor Pay needs a database update</p>
        <p className="mt-2">
          Run migration <code>121_contractor_pay.sql</code> in Supabase, then
          refresh. ({error.message})
        </p>
      </div>
    );
  }

  const myPayments = ((myRows ?? []) as Record<string, unknown>[]).map((r) =>
    mapPayment(r),
  );

  let adminPayments: ContractorPaymentRequest[] = [];
  if (isAdmin) {
    const { data: allRows } = await supabase
      .from("contractor_payment_requests")
      .select("*")
      .order("created_at", { ascending: false });
    const ids = Array.from(
      new Set(
        ((allRows ?? []) as Record<string, unknown>[]).map((r) =>
          String(r.user_id),
        ),
      ),
    );
    const { data: people } = ids.length
      ? await supabase.from("profiles").select("id, full_name").in("id", ids)
      : { data: [] as { id: string; full_name: string }[] };
    const nameById = new Map(
      (people ?? []).map((p) => [p.id as string, p.full_name as string]),
    );
    adminPayments = ((allRows ?? []) as Record<string, unknown>[]).map((r) =>
      mapPayment(r, nameById.get(String(r.user_id)) ?? "Unknown"),
    );
  }

  const { data: myAckRow } = await supabase
    .from("contractor_1099_acknowledgements")
    .select("id, user_id, tax_year, signer_name, signer_email, signed_at")
    .eq("user_id", profile.id)
    .eq("tax_year", taxYear)
    .maybeSingle();

  const myAck: Contractor1099Ack | null = myAckRow
    ? {
        id: String(myAckRow.id),
        user_id: String(myAckRow.user_id),
        tax_year: Number(myAckRow.tax_year),
        signer_name: String(myAckRow.signer_name ?? ""),
        signer_email: String(myAckRow.signer_email ?? ""),
        signed_at: String(myAckRow.signed_at ?? ""),
      }
    : null;

  const { data: myW9Rows } = await supabase
    .from("contractor_w9_files")
    .select("*")
    .eq("user_id", profile.id)
    .order("uploaded_at", { ascending: false })
    .limit(5);

  async function mapW9(
    r: Record<string, unknown>,
    name?: string,
  ): Promise<ContractorW9File> {
    const storagePath = String(r.storage_path ?? "");
    const storageProvider = String(r.storage_provider ?? "supabase");
    let accessUrl: string | null = null;
    if (storagePath) {
      const access = await getEventMediaAccessUrl({
        supabase,
        path: storagePath,
        provider:
          storageProvider === "bunny" || storageProvider === "supabase"
            ? storageProvider
            : "supabase",
        expiresIn: 3600,
      });
      accessUrl = access.url;
    }
    return {
      id: String(r.id),
      user_id: String(r.user_id),
      tax_year: Number(r.tax_year) || taxYear,
      storage_path: storagePath,
      storage_provider: storageProvider,
      file_name: String(r.file_name ?? ""),
      content_type: String(r.content_type ?? ""),
      uploaded_at: String(r.uploaded_at ?? ""),
      access_url: accessUrl,
      ...(name ? { requester_name: name } : {}),
    };
  }

  const myW9Files = await Promise.all(
    ((myW9Rows ?? []) as Record<string, unknown>[]).map((r) => mapW9(r)),
  );

  let adminAcks: Contractor1099Ack[] = [];
  let adminW9Latest: ContractorW9File[] = [];
  if (isAdmin) {
    const { data: ackRows } = await supabase
      .from("contractor_1099_acknowledgements")
      .select("id, user_id, tax_year, signer_name, signer_email, signed_at")
      .eq("tax_year", taxYear)
      .order("signed_at", { ascending: false });
    const { data: w9Rows } = await supabase
      .from("contractor_w9_files")
      .select("*")
      .order("uploaded_at", { ascending: false })
      .limit(200);

    const personIds = new Set<string>();
    for (const r of ackRows ?? []) personIds.add(String(r.user_id));
    for (const r of w9Rows ?? []) personIds.add(String(r.user_id));
    const ids = Array.from(personIds);
    const { data: people } = ids.length
      ? await supabase.from("profiles").select("id, full_name").in("id", ids)
      : { data: [] as { id: string; full_name: string }[] };
    const nameById = new Map(
      (people ?? []).map((p) => [p.id as string, p.full_name as string]),
    );

    adminAcks = ((ackRows ?? []) as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      user_id: String(r.user_id),
      tax_year: Number(r.tax_year),
      signer_name: String(r.signer_name ?? ""),
      signer_email: String(r.signer_email ?? ""),
      signed_at: String(r.signed_at ?? ""),
      requester_name: nameById.get(String(r.user_id)) ?? "Unknown",
    }));

    const latestByUser = new Map<string, Record<string, unknown>>();
    for (const r of (w9Rows ?? []) as Record<string, unknown>[]) {
      const uid = String(r.user_id);
      if (!latestByUser.has(uid)) latestByUser.set(uid, r);
    }
    adminW9Latest = await Promise.all(
      Array.from(latestByUser.values()).map((r) =>
        mapW9(r, nameById.get(String(r.user_id)) ?? "Unknown"),
      ),
    );
  }

  return (
    <ContractorPayClient
      isAdmin={isAdmin}
      taxYear={taxYear}
      defaultName={profile.full_name ?? ""}
      defaultEmail={profile.email ?? ""}
      myPayments={myPayments}
      adminPayments={adminPayments}
      myAck={myAck}
      myW9Files={myW9Files}
      adminAcks={adminAcks}
      adminW9Latest={adminW9Latest}
    />
  );
}
