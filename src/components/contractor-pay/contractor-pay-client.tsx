"use client";

import { FormEvent, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteContractorPaymentAction,
  markContractorPaymentPaidAction,
  reviewContractorPaymentAction,
  signContractor1099Action,
  submitContractorPaymentAction,
  uploadContractorW9Action,
} from "@/app/(app)/contractor-pay/actions";
import { HandbookSignaturePad } from "@/components/handbook/handbook-signature-pad";
import {
  CONTRACTOR_1099_ACK_TEXT,
  CONTRACTOR_PAY_CATEGORIES,
  contractorPayCategoryLabel,
  formatContractorMoney,
  type Contractor1099Ack,
  type ContractorPaymentRequest,
  type ContractorPayStatus,
  type ContractorW9File,
} from "@/lib/types/contractor-pay";

type Props = {
  isAdmin: boolean;
  taxYear: number;
  defaultName: string;
  defaultEmail: string;
  myPayments: ContractorPaymentRequest[];
  adminPayments: ContractorPaymentRequest[];
  myAck: Contractor1099Ack | null;
  myW9Files: ContractorW9File[];
  adminAcks: Contractor1099Ack[];
  adminW9Latest: ContractorW9File[];
};

function fmtDate(iso: string): string {
  if (!iso) return "";
  const day = iso.includes("T") ? iso.slice(0, 10) : iso;
  return new Date(`${day}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const STATUS_STYLES: Record<ContractorPayStatus, string> = {
  pending:
    "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
  approved:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
  denied: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200",
};

function StatusBadge({ status }: { status: ContractorPayStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      {children}
    </section>
  );
}

function PaymentLine({ p }: { p: ContractorPaymentRequest }) {
  return (
    <div className="min-w-0">
      <p className="text-sm font-medium text-[var(--foreground)]">
        {formatContractorMoney(p.amount)} ·{" "}
        {contractorPayCategoryLabel(p.category)}
        <span className="font-normal text-[var(--muted)]">
          {" "}
          · {fmtDate(p.work_date)}
        </span>
      </p>
      {p.event_name ? (
        <p className="text-sm text-[var(--muted)]">{p.event_name}</p>
      ) : null}
      {p.hours != null ? (
        <p className="text-xs text-[var(--muted)]">{p.hours} hours</p>
      ) : null}
      {p.description ? (
        <p className="text-sm text-[var(--muted)]">{p.description}</p>
      ) : null}
    </div>
  );
}

export function ContractorPayClient({
  isAdmin,
  taxYear,
  defaultName,
  defaultEmail,
  myPayments,
  adminPayments,
  myAck,
  myW9Files,
  adminAcks,
  adminW9Latest,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("event_day");
  const [workDate, setWorkDate] = useState(today);
  const [eventName, setEventName] = useState("");
  const [hours, setHours] = useState("");
  const [description, setDescription] = useState("");

  const [signerName, setSignerName] = useState(defaultName);
  const [signerEmail, setSignerEmail] = useState(defaultEmail);
  const [signatureData, setSignatureData] = useState("");
  const [ipAddress, setIpAddress] = useState<string | null>(null);
  const [ackError, setAckError] = useState<string | null>(null);
  const [ackMessage, setAckMessage] = useState<string | null>(null);

  const [w9File, setW9File] = useState<File | null>(null);
  const [w9Error, setW9Error] = useState<string | null>(null);
  const [w9Message, setW9Message] = useState<string | null>(null);

  const pendingAdmin = adminPayments.filter((p) => p.status === "pending");
  const approvedUnpaid = adminPayments.filter(
    (p) => p.status === "approved" && !p.paid_at,
  );
  const reviewedAdmin = adminPayments.filter((p) => p.status !== "pending");

  useEffect(() => {
    fetch("https://api.ipify.org?format=json")
      .then((res) => res.json())
      .then((data: { ip?: string }) => setIpAddress(data.ip ?? null))
      .catch(() => setIpAddress(null));
  }, []);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFormMessage(null);
    startTransition(async () => {
      const result = await submitContractorPaymentAction({
        amount,
        category,
        description,
        workDate,
        eventName,
        hours,
      });
      if (result.error) {
        setFormError(result.error);
        return;
      }
      setAmount("");
      setDescription("");
      setEventName("");
      setHours("");
      setCategory("event_day");
      setWorkDate(today);
      setFormMessage("Payment request submitted. An admin will review it.");
      router.refresh();
    });
  }

  function cancel(id: string) {
    if (!confirm("Delete this payment request?")) return;
    startTransition(async () => {
      const r = await deleteContractorPaymentAction(id);
      if (r.error) alert(r.error);
      else router.refresh();
    });
  }

  function review(id: string, decision: "approved" | "denied") {
    startTransition(async () => {
      const r = await reviewContractorPaymentAction({ id, decision });
      if (r.error) alert(r.error);
      else router.refresh();
    });
  }

  function markPaid(id: string) {
    startTransition(async () => {
      const r = await markContractorPaymentPaidAction(id);
      if (r.error) alert(r.error);
      else router.refresh();
    });
  }

  function handleAck() {
    setAckError(null);
    setAckMessage(null);
    startTransition(async () => {
      const result = await signContractor1099Action({
        signerName,
        signerEmail,
        signatureData,
        taxYear,
        ipAddress,
        userAgent:
          typeof navigator !== "undefined" ? navigator.userAgent : null,
      });
      if (result.error) {
        setAckError(result.error);
        return;
      }
      setAckMessage(`Acknowledgment recorded for tax year ${taxYear}.`);
      router.refresh();
    });
  }

  function handleW9(event: FormEvent) {
    event.preventDefault();
    setW9Error(null);
    setW9Message(null);
    if (!w9File) {
      setW9Error("Choose a PDF or image of your W-9.");
      return;
    }
    startTransition(async () => {
      const result = await uploadContractorW9Action({
        file: w9File,
        taxYear,
      });
      if (result.error) {
        setW9Error(result.error);
        return;
      }
      setW9File(null);
      setW9Message("W-9 uploaded.");
      router.refresh();
    });
  }

  const latestW9 = myW9Files[0] ?? null;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <header>
        <h1 className="text-xl font-semibold text-[var(--foreground)]">
          Contractor Pay
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Request payment for contractor work (separate from Expenses), upload
          your W-9, and complete the annual 1099 acknowledgment.
        </p>
      </header>

      {isAdmin ? (
        <Card>
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            To review
            {pendingAdmin.length > 0 ? (
              <span className="ml-2 inline-flex items-center rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--brand)]">
                {pendingAdmin.length}
              </span>
            ) : null}
          </h2>
          {pendingAdmin.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]">
              No payment requests waiting on you.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {pendingAdmin.map((p) => (
                <li
                  key={p.id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--foreground)]">
                        {p.requester_name}
                      </p>
                      <PaymentLine p={p} />
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => review(p.id, "approved")}
                        className="inline-flex h-8 items-center rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => review(p.id, "denied")}
                        className="inline-flex h-8 items-center rounded-lg border border-[var(--border)] px-3 text-xs font-medium text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] disabled:opacity-50"
                      >
                        Deny
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {approvedUnpaid.length > 0 ? (
            <div className="mt-5 border-t border-[var(--border)] pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                Approved — awaiting payment
              </h3>
              <ul className="mt-2 space-y-2">
                {approvedUnpaid.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--background)] p-3"
                  >
                    <span className="text-sm text-[var(--foreground)]">
                      {p.requester_name} · {formatContractorMoney(p.amount)} ·{" "}
                      {contractorPayCategoryLabel(p.category)}
                    </span>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => markPaid(p.id)}
                      className="inline-flex h-8 items-center rounded-lg bg-[var(--brand)] px-3 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                    >
                      Mark paid
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          Tax year {taxYear} — W-9 &amp; 1099 acknowledgment
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Upload a current W-9 and digitally acknowledge your 1099 contractor
          status for this tax year. Admins use this roster for year-end filing.
        </p>

        <div className="mt-4 space-y-4 border-t border-[var(--border)] pt-4">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              Your W-9
            </h3>
            {latestW9 ? (
              <p className="mt-2 text-sm text-[var(--foreground)]">
                On file:{" "}
                {latestW9.access_url ? (
                  <a
                    href={latestW9.access_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-[var(--brand)] hover:underline"
                  >
                    {latestW9.file_name || "View W-9"}
                  </a>
                ) : (
                  latestW9.file_name || "Uploaded"
                )}{" "}
                <span className="text-[var(--muted)]">
                  · {fmtDate(latestW9.uploaded_at)}
                </span>
              </p>
            ) : (
              <p className="mt-2 text-sm text-[var(--muted)]">
                No W-9 uploaded yet for this account.
              </p>
            )}
            <form onSubmit={handleW9} className="mt-3 space-y-2">
              <input
                type="file"
                accept="image/*,application/pdf,.heic,.heif"
                onChange={(e) => setW9File(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-[var(--foreground)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--brand-soft)] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[var(--brand)]"
              />
              {w9Error ? (
                <p className="text-sm text-red-700 dark:text-red-300">
                  {w9Error}
                </p>
              ) : null}
              {w9Message ? (
                <p className="text-sm text-emerald-700 dark:text-emerald-300">
                  {w9Message}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={pending || !w9File}
                className="inline-flex h-9 items-center rounded-lg border border-[var(--border)] px-4 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending ? "Uploading…" : latestW9 ? "Replace W-9" : "Upload W-9"}
              </button>
            </form>
          </div>

          <div className="border-t border-[var(--border)] pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              Annual 1099 acknowledgment
            </h3>
            {myAck ? (
              <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
                Signed by {myAck.signer_name} on {fmtDate(myAck.signed_at)}.
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                <p className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-3 text-sm text-[var(--foreground)]">
                  {CONTRACTOR_1099_ACK_TEXT}
                </p>
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-[var(--foreground)]">
                    Full name
                  </span>
                  <input
                    type="text"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-[var(--foreground)]">
                    Email
                  </span>
                  <input
                    type="email"
                    value={signerEmail}
                    onChange={(e) => setSignerEmail(e.target.value)}
                    className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
                  />
                </label>
                <HandbookSignaturePad
                  onChange={(signedPad, dataUrl) => {
                    setSignatureData(signedPad ? dataUrl : "");
                  }}
                />
                {ipAddress ? (
                  <p className="text-xs text-[var(--muted)]">
                    IP Address: {ipAddress}
                  </p>
                ) : null}
                {ackError ? (
                  <p className="text-sm text-red-700 dark:text-red-300">
                    {ackError}
                  </p>
                ) : null}
                <button
                  type="button"
                  disabled={pending || !signatureData || !signerName.trim()}
                  onClick={handleAck}
                  className="inline-flex h-9 items-center rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {pending ? "Saving…" : `Sign for ${taxYear}`}
                </button>
              </div>
            )}
            {ackMessage ? (
              <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
                {ackMessage}
              </p>
            ) : null}
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          Request payment
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          For contractor pay only. Use{" "}
          <a href="/expenses" className="text-[var(--brand)] hover:underline">
            Expenses
          </a>{" "}
          for reimbursable out-of-pocket costs.
        </p>
        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-[var(--foreground)]">
                Amount
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-[var(--foreground)]">
                Category
              </span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
              >
                {CONTRACTOR_PAY_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-[var(--foreground)]">
                Work date
              </span>
              <input
                type="date"
                required
                max={today}
                value={workDate}
                onChange={(e) => setWorkDate(e.target.value)}
                className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
              />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-[var(--foreground)]">
                Event / job{" "}
                <span className="text-[var(--muted)]">(optional)</span>
              </span>
              <input
                type="text"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="Client or event name"
                className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-[var(--foreground)]">
                Hours <span className="text-[var(--muted)]">(optional)</span>
              </span>
              <input
                type="number"
                min="0"
                step="0.25"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="e.g. 8"
                className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
              />
            </label>
          </div>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-[var(--foreground)]">
              Notes
            </span>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this payment for?"
              className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
            />
          </label>
          {formError ? (
            <p className="text-sm text-red-700 dark:text-red-300">{formError}</p>
          ) : null}
          {formMessage ? (
            <p className="text-sm text-emerald-700 dark:text-emerald-300">
              {formMessage}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={pending || !amount}
            className="inline-flex h-9 items-center rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Submitting…" : "Submit payment request"}
          </button>
        </form>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          My payment requests
        </h2>
        {myPayments.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">
            You haven’t submitted any payment requests yet.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--border)]">
            {myPayments.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3"
              >
                <PaymentLine p={p} />
                <div className="flex items-center gap-3">
                  {p.paid_at ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                      Paid
                    </span>
                  ) : (
                    <StatusBadge status={p.status} />
                  )}
                  {p.status === "pending" ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => cancel(p.id)}
                      className="text-xs font-medium text-[var(--muted)] underline-offset-2 hover:text-[var(--foreground)] hover:underline disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {isAdmin ? (
        <Card>
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            1099 roster · {taxYear}
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Who has signed the annual acknowledgment and who has a W-9 on file.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                Acknowledgments ({adminAcks.length})
              </h3>
              {adminAcks.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--muted)]">None yet.</p>
              ) : (
                <ul className="mt-2 divide-y divide-[var(--border)]">
                  {adminAcks.map((a) => (
                    <li key={a.id} className="py-2 text-sm text-[var(--foreground)]">
                      {a.requester_name || a.signer_name}
                      <span className="text-[var(--muted)]">
                        {" "}
                        · {fmtDate(a.signed_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                Latest W-9s ({adminW9Latest.length})
              </h3>
              {adminW9Latest.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--muted)]">None yet.</p>
              ) : (
                <ul className="mt-2 divide-y divide-[var(--border)]">
                  {adminW9Latest.map((w) => (
                    <li key={w.id} className="py-2 text-sm text-[var(--foreground)]">
                      {w.requester_name}
                      {w.access_url ? (
                        <>
                          {" · "}
                          <a
                            href={w.access_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-[var(--brand)] hover:underline"
                          >
                            {w.file_name || "View"}
                          </a>
                        </>
                      ) : null}
                      <span className="text-[var(--muted)]">
                        {" "}
                        · {fmtDate(w.uploaded_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Card>
      ) : null}

      {isAdmin && reviewedAdmin.length > 0 ? (
        <Card>
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            All reviewed
          </h2>
          <ul className="mt-3 divide-y divide-[var(--border)]">
            {reviewedAdmin.slice(0, 40).map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5"
              >
                <span className="text-sm text-[var(--foreground)]">
                  {p.requester_name} · {formatContractorMoney(p.amount)} ·{" "}
                  {contractorPayCategoryLabel(p.category)}
                </span>
                {p.paid_at ? (
                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                    Paid
                  </span>
                ) : (
                  <StatusBadge status={p.status} />
                )}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
