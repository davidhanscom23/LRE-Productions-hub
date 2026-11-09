"use client";

import { useEffect, useState } from "react";
import { HandbookSignaturePad } from "@/components/handbook/handbook-signature-pad";
import { customerDocKindLabel, type CustomerDocKind } from "@/lib/av-erp/customer-esign";

export type CustomerEsignFormValues = {
  response: "accepted" | "declined";
  signerName: string;
  signerEmail: string;
  signatureData: string;
  note: string;
  ipAddress: string | null;
  userAgent: string | null;
};

type Props = {
  docKind: CustomerDocKind;
  pending: boolean;
  error: string | null;
  defaultName?: string;
  defaultEmail?: string;
  acceptLabel?: string;
  declineLabel?: string;
  onSubmit: (values: CustomerEsignFormValues) => void;
};

export function CustomerEsignForm({
  docKind,
  pending,
  error,
  defaultName = "",
  defaultEmail = "",
  acceptLabel,
  declineLabel,
  onSubmit,
}: Props) {
  const label = customerDocKindLabel(docKind);
  const [note, setNote] = useState("");
  const [fullName, setFullName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [hasSigned, setHasSigned] = useState(false);
  const [signatureData, setSignatureData] = useState("");
  const [ipAddress, setIpAddress] = useState<string | null>(null);
  const [mode, setMode] = useState<"choose" | "accept" | "decline">("choose");

  useEffect(() => {
    let cancelled = false;
    fetch("https://api.ipify.org?format=json")
      .then((r) => r.json())
      .then((data: { ip?: string }) => {
        if (!cancelled && data.ip) setIpAddress(data.ip);
      })
      .catch(() => {
        /* audit IP is best-effort */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function userAgent() {
    return typeof navigator !== "undefined" ? navigator.userAgent : null;
  }

  if (mode === "choose") {
    return (
      <div className="mt-8 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-5">
        <h3 className="text-sm font-semibold">Your response</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Accept this {label.toLowerCase()} with an electronic signature, or
          decline with an optional note.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => setMode("accept")}
            className="h-9 rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            {acceptLabel ?? `Accept ${label.toLowerCase()}`}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setMode("decline")}
            className="h-9 rounded-lg border border-[var(--border)] px-4 text-sm disabled:opacity-50"
          >
            {declineLabel ?? "Decline"}
          </button>
        </div>
        {error ? (
          <p className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</p>
        ) : null}
      </div>
    );
  }

  if (mode === "decline") {
    return (
      <div className="mt-8 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-5">
        <h3 className="text-sm font-semibold">Decline {label.toLowerCase()}</h3>
        <label className="mt-3 block text-sm">
          <span className="mb-1 block text-[var(--muted)]">Note (optional)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          />
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              onSubmit({
                response: "declined",
                signerName: "",
                signerEmail: "",
                signatureData: "",
                note,
                ipAddress,
                userAgent: userAgent(),
              })
            }
            className="h-9 rounded-lg border border-[var(--border)] px-4 text-sm font-semibold disabled:opacity-50"
          >
            Confirm decline
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setMode("choose")}
            className="h-9 px-3 text-sm text-[var(--muted)] underline-offset-2 hover:underline"
          >
            Back
          </button>
        </div>
        {error ? (
          <p className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</p>
        ) : null}
      </div>
    );
  }

  const canAccept = Boolean(fullName.trim() && hasSigned && signatureData);

  return (
    <div className="mt-8 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-5">
      <h3 className="text-sm font-semibold">Accept {label.toLowerCase()}</h3>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Draw your signature below to confirm. This is a legally binding
        electronic signature.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-[var(--muted)]">Full name *</span>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            autoComplete="name"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-[var(--muted)]">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            autoComplete="email"
          />
        </label>
      </div>

      <div className="mt-4">
        <HandbookSignaturePad
          onChange={(signedPad, dataUrl) => {
            setHasSigned(signedPad);
            setSignatureData(dataUrl);
          }}
        />
      </div>

      <label className="mt-3 block text-sm">
        <span className="mb-1 block text-[var(--muted)]">Note (optional)</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
        />
      </label>

      <p className="mt-4 text-[11px] leading-relaxed text-[var(--muted)]">
        By clicking &quot;Sign &amp; accept&quot; below, I acknowledge that this
        constitutes a legally binding electronic signature in accordance with the
        U.S. Electronic Signatures in Global and National Commerce Act (E-SIGN
        Act) and the Uniform Electronic Transactions Act (UETA). My IP address,
        timestamp, and browser information will be recorded.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || !canAccept}
          onClick={() =>
            onSubmit({
              response: "accepted",
              signerName: fullName,
              signerEmail: email,
              signatureData,
              note,
              ipAddress,
              userAgent: userAgent(),
            })
          }
          className="h-9 rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          Sign &amp; accept {label.toLowerCase()}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setMode("choose")}
          className="h-9 px-3 text-sm text-[var(--muted)] underline-offset-2 hover:underline"
        >
          Back
        </button>
      </div>
      {error ? (
        <p className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</p>
      ) : null}
    </div>
  );
}
