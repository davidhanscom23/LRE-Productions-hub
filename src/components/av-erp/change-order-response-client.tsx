"use client";

import { useState, useTransition } from "react";
import { respondToPublicChangeOrderAction } from "@/app/change-order/[token]/respond-actions";
import {
  CustomerEsignForm,
  type CustomerEsignFormValues,
} from "@/components/av-erp/customer-esign-form";

type Props = {
  token: string;
  existingStatus: "accepted" | "declined" | null;
  existingNote: string;
  existingSignerName?: string;
  defaultName?: string;
  defaultEmail?: string;
};

export function ChangeOrderResponseClient({
  token,
  existingStatus,
  existingNote,
  existingSignerName = "",
  defaultName = "",
  defaultEmail = "",
}: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(existingStatus);
  const [note, setNote] = useState(existingNote);
  const [signer, setSigner] = useState(existingSignerName);

  if (done) {
    return (
      <div className="mt-8 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-5 text-center">
        <p className="text-base font-semibold">
          {done === "accepted"
            ? "Change order accepted"
            : "Change order declined"}
        </p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Thanks — LRE has been notified.
        </p>
        {done === "accepted" && signer.trim() ? (
          <p className="mt-2 text-sm text-[var(--muted)]">
            Signed by {signer.trim()}
          </p>
        ) : null}
        {note.trim() ? (
          <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--muted)]">
            {note}
          </p>
        ) : null}
      </div>
    );
  }

  function submit(values: CustomerEsignFormValues) {
    setError(null);
    startTransition(async () => {
      const result = await respondToPublicChangeOrderAction({
        token,
        ...values,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(result.response);
      setNote(values.note);
      setSigner(values.signerName);
    });
  }

  return (
    <CustomerEsignForm
      docKind="change_order"
      pending={pending}
      error={error}
      defaultName={defaultName}
      defaultEmail={defaultEmail}
      onSubmit={submit}
    />
  );
}
